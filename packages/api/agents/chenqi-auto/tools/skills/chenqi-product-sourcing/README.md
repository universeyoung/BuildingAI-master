# 辰启 v1.0 - 选品调研 Skill

> 详细说明请见 [SKILL.md](SKILL.md)

## 快速开始

```powershell
# 1. 自检
python scripts/setup_check.py

# 2. 主入口
python scripts/run.py --prompt "夏季女装连衣裙，选 3 条"

# 或兜底模式
python scripts/run.py
```

## 前置条件

1. 已跑过 `chenqi-lark-setup`（产出 `output/base_info.json`）
2. Schema 版本 ≥ v3.1.0（含选品状态机字段）
3. Chrome 已登录 1688
4. Python 3.10+ + PyYAML

## 协议

- **入口信号**：写新 SKU 时同时置 `采集状态 = C_TODO`，触发下游
- **状态机**：S_TODO → S_DOING → S_DONE / S_FAILED
- **去重**：跑前一次性拉飞书 `1688商品ID` 列做内存 set
- **滑块**：直接标记 SOURCING_CAPTCHA 跳过（方案 A）
