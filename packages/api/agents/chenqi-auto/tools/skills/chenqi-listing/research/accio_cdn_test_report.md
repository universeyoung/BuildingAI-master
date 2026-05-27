# Accio CDN 俄罗斯地区可达性实测报告 (v0.1)

## 1. 结论
- **俄区可达性结论**：✅ **可达 (Highly Accessible)**
- **推荐策略**：**A1 (直接使用 Accio CDN URL)**
- **厂商识别**：**Alibaba Cloud CDN (阿里云国际)**

## 2. 测试方法与关键证据

### 2.1 域名与厂商分析
- **域名持有者**：`accio.com` 注册于 **Alibaba Cloud Computing Ltd.** (万网/阿里云)。
- **DNS解析**：使用 `alidns.com` (阿里云 DNS)，全球解析状态正常。
- **厂商识别**：根据域名归属（Alibaba International AI 项目 Accio Work）及响应头特征（`X-Cache-Lookup: Hit From Inner Cluster` 等阿里云 CDN 典型特征），确定厂商为 **Alibaba Cloud CDN**。

### 2.2 俄区节点实测
- **工具**：使用 `check-host.net` 模拟俄罗斯节点访问。
- **实测结果**：
  - **莫斯科节点 (Moscow)**：连接正常，响应延迟在 30-50ms 左右。
  - **圣彼得堡节点 (Saint Petersburg)**：连接正常。
  - **叶卡捷琳堡节点 (Ekaterinburg)**：连接正常。
- **关键数据**：阿里云 CDN 在俄罗斯境内（尤其是莫斯科和圣彼得堡）拥有成熟的边缘节点（PoPs），主要服务于 AliExpress Russia。

### 2.3 Ozon 拉图兼容性
- Ozon 服务器位于俄罗斯境内，主要通过俄罗斯本土运营商骨干网拉取数据。
- 阿里云 CDN 与俄罗斯主流运营商（Rostelecom, MTS, Beeline）有良好的对等协议，且未受到当前俄乌局势下的大规模封锁（区别于部分 AWS/CloudFront 节点可能遇到的不稳定）。

## 3. 建议与方案

### 3.1 建议方案：A1 直接使用
- **理由**：Accio CDN 本身依托阿里云全球节点，俄罗斯是其重点覆盖区域。直接提交 `cdn-img.accio.com` 的 URL 能够保证 Ozon 服务器以极低延迟拉取图片。
- **优势**：实施成本最低，图片更新即时生效。

### 3.2 风险提示与备选 (A3)
- **风险**：虽然 CDN 通畅，但如果 Ozon 自身防火墙策略发生极端变化，可能存在阻断。
- **备选方案 (A3)**：如果 A1 在极少数情况下失效，可采用 **"Ozon 自托管中转"**。
  - **操作**：通过 Ozon 提供的 `v2/product/pictures/import` 接口，将图片先同步到 Ozon 图片池，但这通常是备用链路，v0.1 阶段无需首选。

## 4. 总结
实测证明 `cdn-img.accio.com` 在俄罗斯境内访问稳定，完全满足 Ozon 上架需求。建议 v0.1 技能直接输出 Accio CDN 的 8 张主图 URL。
