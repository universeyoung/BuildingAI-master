"""
辰启技能 License 校验核心模块
==============================

公开 API：
    _verify_or_die(__file__)   业务脚本启动时立即校验，失败 sys.exit(1)

设计原则：
    - 离线（纯本地 RSA 签名，不联网）
    - 时间过期型 365 天（issued_at + days）
    - 不绑机（一客户一 license，可换电脑）
    - 提前 3 天 banner 提示
    - 防系统时间倒流（runtime.json 记录 last_seen_ts）
    - 敏感常量 AES 运行时解密（提高反编译门槛）

License 文件格式（JSON + Base64 签名）：
    {
      "license_id":     "<uuid>",
      "customer_id":    "kehu_001",
      "customer_name":  "客户名",
      "issued_at":      1734567890,        # Unix 秒
      "expires_at":     1766103890,        # Unix 秒
      "days":           365,
      "pack_version":   "v14",
      "_signature":     "<base64 RSA-PSS over JSON minus _signature>"
    }

部署位置：
    %USERPROFILE%/.chenqi/license.lic       # 客户提供
    %USERPROFILE%/.chenqi/runtime.json      # 本模块维护
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
from pathlib import Path

# ============================================================
# 嵌入公钥（与 chenqi-license-admin/keys/public_key.pem 对应）
# 这是公钥，泄露无影响——只用来验证签名
# ============================================================
_PUBLIC_KEY_PEM = b"""-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyNjLjNqwudiqLt2V+zlw
bDeNB8pIwVEr5rNjKIHBKuJny/8/8QVoA/7omfmDWyHM/yQJ6QLeAZ9qRu6PfmKJ
aUMbYMLskOLE3rpWg3hQbmMkRgNjZwKPRLIZCkhxnW+0jVQfxtd7nB1WVkNIkbph
UZE1jiIBV5MCXEExa3wbMvvzLis15tTdFRt0tU41lYIHUmxSHNZI5qlTf8x4aaPB
rFFc+DkNXabnEa6Fn0QewSLVrcgtG97lFOIJ6WrWc6w7MgMf4e1TfY2KuMNISuyt
gFG/TQckq9Tp9n0QXn+RR/t/zadkAVFFCXqjli9Cr8JD70zcPmHK44VXOEWeuD06
lwIDAQAB
-----END PUBLIC KEY-----"""

# ============================================================
# AES-256-GCM 密钥（用于解密打包后的 bytecode payload）
# 硬编码到此模块常量；反编译 .pyc 后能拿到，但已大幅提升门槛
# 业务源码 → minify → bytecode → marshal → AES-256-GCM → base64
# ============================================================
_AES_KEY = b"\xc7\x3a\x9f\x21\x88\xe4\x55\x6b\x12\x8d\x70\xa1\x4f\x9e\x33\x6c\x2d\x59\xb8\xa7\x14\xff\x0c\x55\x91\x88\x73\xea\xb2\x6f\x91\x44"

# 路径常量
_LIC_DIR_NAME = ".chenqi"
_LIC_FILE_NAME = "license.lic"
_RUNTIME_FILE_NAME = "runtime.json"
_BANNER_THRESHOLD_DAYS = 3

# ============================================================
# 缓存：一个进程内只校验一次，避免每个业务脚本 import 都跑一遍
# ============================================================
_VERIFIED = False


# ------------------------------------------------------------
# 内部工具
# ------------------------------------------------------------

def _die(msg: str, code: int = 1) -> None:
    """统一退出：打印中文红字提示 + 立即退"""
    # ANSI 红色（Windows 10+ 终端支持）；不支持时只显示文字
    red = "\033[91m"
    rst = "\033[0m"
    sys.stderr.write(f"\n{red}[辰启 License] {msg}{rst}\n")
    sys.stderr.write(f"{red}  脚本已停止运行。如需续期请联系开发者。{rst}\n\n")
    sys.stderr.flush()
    sys.exit(code)


def _banner(msg: str) -> None:
    """黄色 warning banner，不退出"""
    yellow = "\033[93m"
    rst = "\033[0m"
    sys.stderr.write(f"\n{yellow}[辰启 License] {msg}{rst}\n\n")
    sys.stderr.flush()


def _get_lic_dir() -> Path:
    """%USERPROFILE%/.chenqi/   兼容 Linux/Mac 用 $HOME"""
    home = Path(os.path.expanduser("~"))
    d = home / _LIC_DIR_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_license() -> dict:
    """读 license.lic，缺失/损坏直接 _die"""
    lic_path = _get_lic_dir() / _LIC_FILE_NAME
    if not lic_path.exists():
        _die(
            f"未找到 license 文件: {lic_path}\n"
            f"  请把开发者发给您的 license.lic 放到该路径下。"
        )
    try:
        return json.loads(lic_path.read_text(encoding="utf-8"))
    except Exception as e:
        _die(f"License 文件损坏或格式错误: {lic_path}\n  详情: {e}")
        return {}  # unreachable


def _verify_signature(lic: dict) -> None:
    """RSA-PSS-SHA256 验证签名；失败 _die"""
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.exceptions import InvalidSignature
    except ImportError:
        _die("缺少 cryptography 依赖，请 pip install cryptography>=42.0.0")
        return  # unreachable

    sig_b64 = lic.get("_signature")
    if not sig_b64:
        _die("License 缺少签名字段 _signature")
        return  # unreachable

    payload = {k: v for k, v in lic.items() if k != "_signature"}
    payload_bytes = json.dumps(
        payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")

    try:
        sig = base64.b64decode(sig_b64)
        pub = serialization.load_pem_public_key(_PUBLIC_KEY_PEM)
        pub.verify(  # type: ignore[union-attr]
            sig,
            payload_bytes,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            hashes.SHA256(),
        )
    except InvalidSignature:
        _die("License 签名校验失败（文件可能被篡改）")
    except Exception as e:
        _die(f"License 签名校验异常: {e}")


def _check_expiry(lic: dict) -> None:
    """检查 expires_at；过期 _die；剩余 ≤ 3 天 banner"""
    now = int(time.time())
    expires_at = int(lic.get("expires_at", 0))
    if expires_at <= 0:
        _die("License 缺少 expires_at 字段")
        return

    if now >= expires_at:
        from datetime import datetime
        exp_str = datetime.fromtimestamp(expires_at).strftime("%Y-%m-%d %H:%M:%S")
        _die(f"License 已过期（过期时间: {exp_str}），请联系开发者续期。")
        return

    remain_days = (expires_at - now) // 86400
    if remain_days <= _BANNER_THRESHOLD_DAYS:
        from datetime import datetime
        exp_str = datetime.fromtimestamp(expires_at).strftime("%Y-%m-%d")
        _banner(
            f"License 即将到期：还剩 {remain_days} 天（到期日 {exp_str}）。\n"
            f"  请尽快联系开发者续期，避免影响业务。"
        )


def _check_runtime(lic: dict) -> None:
    """
    防系统时间倒流：
      - 启动时写 runtime.json: {last_seen_ts: now, license_id: lic.license_id}
      - 下次启动若 now < last_seen_ts - 容差（86400 秒），判定倒流
      - 容差给一天，避免轻微时区/时钟漂移误杀
    """
    runtime_path = _get_lic_dir() / _RUNTIME_FILE_NAME
    now = int(time.time())
    tolerance = 86400  # 1 天

    last_seen = 0
    if runtime_path.exists():
        try:
            data = json.loads(runtime_path.read_text(encoding="utf-8"))
            # license 切换时 last_seen 重置（换 license 是合法操作）
            if data.get("license_id") == lic.get("license_id"):
                last_seen = int(data.get("last_seen_ts", 0))
        except Exception:
            last_seen = 0  # runtime.json 损坏视为首次

    if last_seen > 0 and now < last_seen - tolerance:
        from datetime import datetime
        last_str = datetime.fromtimestamp(last_seen).strftime("%Y-%m-%d %H:%M:%S")
        now_str = datetime.fromtimestamp(now).strftime("%Y-%m-%d %H:%M:%S")
        _die(
            f"检测到系统时间异常倒流：\n"
            f"  上次运行时间: {last_str}\n"
            f"  当前系统时间: {now_str}\n"
            f"  请校准系统时间后重试。"
        )

    # 写入最新 last_seen（取 max 防止本次时间小于已存）
    new_data = {
        "license_id": lic.get("license_id"),
        "customer_id": lic.get("customer_id"),
        "last_seen_ts": max(now, last_seen),
    }
    try:
        runtime_path.write_text(
            json.dumps(new_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception:
        pass  # 写失败不致命，下次还能跑


# ------------------------------------------------------------
# 公开 API
# ------------------------------------------------------------

def _verify_or_die(caller_file: str = "") -> None:
    """
    业务脚本启动时立即调用：
        from _chenqi_common.chenqi_license import _verify_or_die
        _verify_or_die(__file__)

    任何校验失败立即 sys.exit(1)；通过则静默返回。
    一个 Python 进程内只校验一次（cached）。
    """
    global _VERIFIED
    if _VERIFIED:
        return

    lic = _load_license()
    _verify_signature(lic)
    _check_expiry(lic)
    _check_runtime(lic)

    _VERIFIED = True


# ============================================================
# 加密 bytecode 装载器（B 方案三层壳）
# ============================================================

def _aes_decrypt(b64_blob: str) -> bytes:
    """AES-256-GCM 解密
    输入 base64(nonce[12] + ciphertext + tag[16])
    输出 plaintext bytes
    """
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        _die("缺少 cryptography 依赖，请 pip install cryptography>=42.0.0")
        return b""  # unreachable

    blob = base64.b64decode(b64_blob)
    nonce = blob[:12]
    ct_and_tag = blob[12:]
    try:
        return AESGCM(_AES_KEY).decrypt(nonce, ct_and_tag, None)
    except Exception as e:
        _die(f"加密模块解密失败（包损坏或被篡改）: {e}")
        return b""  # unreachable


def _exec_encrypted(mod_name: str, b64_blob: str, caller_globals: dict) -> None:
    """业务壳脚本调用：
        from _chenqi_common.chenqi_license import _verify_or_die, _exec_encrypted
        _verify_or_die(__file__)
        _exec_encrypted(__name__, "<b64 blob>", globals())

    解密→base64 解码→marshal.loads→exec 到调用方的 globals。
    """
    import marshal

    # 已校验过 license（_verify_or_die 在前面跑过），这里只解密+执行
    plain = _aes_decrypt(b64_blob)
    try:
        # plain = base64(marshal(code_obj))
        marshaled = base64.b64decode(plain)
        code = marshal.loads(marshaled)
    except Exception as e:
        _die(f"加密模块加载失败: {e}")
        return

    # 把 __name__ 设对，让 if __name__ == '__main__': 正常工作
    caller_globals["__name__"] = mod_name
    try:
        exec(code, caller_globals)
    except SystemExit:
        raise
    except Exception:
        # 业务异常透传，不要被 license 模块吞掉
        raise


# ------------------------------------------------------------
# CLI: 手动测试
#   python chenqi_license.py            # 跑一次校验
#   python chenqi_license.py --info     # 看当前 license 详情
# ------------------------------------------------------------

def _cli() -> int:
    import argparse
    p = argparse.ArgumentParser(description="辰启 License 校验工具")
    p.add_argument("--info", action="store_true", help="显示当前 license 详情")
    args = p.parse_args()

    if args.info:
        lic = _load_license()
        from datetime import datetime
        print("==== 当前 License 详情 ====")
        for k in ("license_id", "customer_id", "customer_name", "pack_version", "days"):
            print(f"  {k:15s}: {lic.get(k)}")
        for k in ("issued_at", "expires_at"):
            ts = lic.get(k)
            ts_str = (
                datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
                if ts else "-"
            )
            print(f"  {k:15s}: {ts} ({ts_str})")
        remain = (int(lic.get("expires_at", 0)) - int(time.time())) // 86400
        print(f"  remain_days    : {remain}")
        print()

    _verify_or_die(__file__)
    print("[OK] License 校验通过")
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
