# Software Requirements Specification

## 团队协作功能 (Team Collaboration)

---

| 字段 | 值 |
|------|-----|
| **文档版本** | 1.0.0 |
| **作者** | AI Assistant |
| **创建日期** | 2025-07-16 |
| **状态** | Draft |
| **关联模块** | 对话 (Conversation)、智能体 (Agent)、知识库 (Knowledge Base) |

---

## 1. Introduction

### 1.1 Purpose

本文档定义"团队协作功能"的完整软件需求。该功能是现有系统（对话、智能体、知识库）的扩展模块，使多个本地智能体能够组成团队，在团队领导的管理下协作完成复杂任务。

### 1.2 Scope

本需求覆盖以下能力域：

- 团队与成员的 CRUD 管理
- 本地智能体的发现、加载与能力匹配
- 团队领导的任务规划、分工、调度、督促、审核、总结
- 三种协作模式：消息式、工作流式(DAG)、共享空间式
- 任务完整生命周期管理
- 进度追踪与实时状态推送
- 经验提取与持续学习
- AI 模型偏好配置与运行时切换
- API 密钥管理、并发限制(5 用户/密钥)与最优密钥自动选择

### 1.3 Definitions

| 术语 | 定义 |
|------|------|
| **智能体 (Agent)** | 具备特定技能(Skills)的 AI 单元，目录结构类似技能包，包含 `AGENT.yaml` 清单、`skills/`、`tools/` 等。 |
| **团队 (Team)** | 多个智能体组成的协作单元，在团队领导管理下共同完成任务。 |
| **团队领导 (Team Lead)** | 负责规划、分工、调度、督促、审核、总结的角色。支持 Human(人类用户)、AI(智能体)、Dual(双领导) 三种模式。 |
| **主任务 (Task)** | 团队需要完成的顶层工作单元，包含目标、截止时间、协作模式配置。 |
| **子任务 (Subtask)** | 由主任务拆分而来的原子工作单元，分配给单个智能体独立执行。 |
| **DAG** | 有向无环图，描述子任务间的依赖关系与执行顺序。 |
| **协作空间 (Collaboration Space)** | 团队成员共享的上下文环境，包含消息流、共享记忆、共享文件。 |
| **经验卡片 (Experience Card)** | 从历史任务中提取的结构化经验/教训，支持检索复用。 |
| **API 密钥池 (Key Pool)** | 多个同提供商 API 密钥的逻辑分组，支持负载均衡和故障转移。 |
| **模型路由 (Model Routing)** | 根据任务类型、模型可用性、成本约束自动选择最优 AI 模型的策略。 |

### 1.4 References

- IEEE 830-1998: Recommended Practice for Software Requirements Specifications
- 现有系统架构文档 (对话/智能体/知识库模块)
- 技能包规范 (Skill Package Specification)

---

## 2. Overall Description

### 2.1 Product Perspective

本功能是现有 AI 平台的扩展模块。现有系统包含：

- **对话模块**：用户与 AI 的多轮交互
- **智能体模块**：可独立运行的 AI 能力单元
- **知识库模块**：知识的存储与检索

当前限制：智能体彼此隔离，无法协作。本功能填补这一空白。

### 2.2 Product Functions

核心功能模块：

1. **团队管理**：团队创建/编辑/删除，成员增减
2. **智能体发现**：扫描本地目录，加载合法智能体，技能匹配查询
3. **团队领导**：任务拆解、智能体指派、DAG 规划、命令下发、进度追踪、督促审核
4. **协作引擎**：消息路由、DAG 调度、共享空间管理
5. **任务生命周期**：创建→规划→就绪→执行→审核→完成→归档
6. **总结学习**：自动总结、经验提取、策略优化
7. **模型与密钥管理**：智能体模型偏好、运行时切换、密钥并发限制、最优密钥选择

### 2.3 User Characteristics

| 角色 | 描述 |
|------|------|
| **Human Lead** | 人类用户担任团队领导，通过 UI 或自然语言管理团队 |
| **AI Lead** | AI 智能体担任团队领导，自动规划和管理 |
| **Agent Member** | 普通智能体成员，接收并执行子任务 |
| **System Admin** | 配置扫描路径、资源限制、安全策略 |

### 2.4 Operating Environment

- 本地智能体存储于 `~/.agents/` 和 `./agents/` 目录（路径可配置）
- 后端服务：Python 3.11+ / Node.js 20+
- 数据库：PostgreSQL 15+ (主存储) + Redis (实时状态/消息队列)
- 前端：React 18+ / Vue 3+ (Web UI)
- 实时通信：WebSocket / SSE

### 2.5 Assumptions and Dependencies

- **AS-001**：现有智能体模块运行正常，智能体可独立执行任务
- **AS-002**：本地智能体符合 `AGENT.yaml` 清单规范
- **AS-003**：系统有足够资源支持多智能体并发执行
- **DE-001**：依赖现有对话模块的消息分发能力
- **DE-002**：依赖现有知识库模块存储经验卡片和共享记忆

---

## 3. Functional Requirements

### 3.1 团队管理 (Team Management)

**REQ-FUNC-001**
- **Name**: 创建团队
- **Priority**: P0
- **Description**: 用户创建一个团队，指定名称、描述和领导类型(Human/AI/Dual)。系统自动生成唯一 `teamId`，初始化协作空间。
- **Input**: `{ name: string, description?: string, leadType: "human"|"ai"|"dual", leadAgentId?: UUID }`
- **Output**: `{ teamId: UUID, name, description, leadType, createdAt: datetime }`
- **Acceptance Criteria**:
  - Given 用户输入团队名称和领导类型, When 提交创建请求, Then 系统返回 `teamId` 且团队出现在团队列表中
  - Given `leadType=ai` 但未指定 `leadAgentId`, When 提交创建请求, Then 系统返回错误提示"AI 领导模式下必须指定领导智能体"

**REQ-FUNC-002**
- **Name**: 查询团队列表
- **Priority**: P1
- **Description**: 按名称、创建时间、成员数筛选，分页返回团队列表。每页默认 20 条。
- **Input**: `{ name?: string, leadType?: string, page?: int, pageSize?: int }`
- **Output**: `{ items: Team[], total: int, page: int, pageSize: int }`
- **Acceptance Criteria**:
  - Given 存在 50 个团队, When 查询第 2 页且 `pageSize=20`, Then 返回第 21-40 个团队且 `total=50`
  - Given 搜索关键词"市场", When 查询, Then 仅返回名称或描述包含"市场"的团队

**REQ-FUNC-003**
- **Name**: 获取团队详情
- **Priority**: P1
- **Description**: 查看团队完整信息：基本信息、成员列表(含技能标签)、历史任务数、成功率、协作空间状态。
- **Input**: `teamId: UUID`
- **Output**: `Team (含 members[], stats, space)`
- **Acceptance Criteria**:
  - Given 有效的 `teamId`, When 查询, Then 返回完整团队详情(响应时间 < 500ms)
  - Given 无效 `teamId`, When 查询, Then 返回 404

**REQ-FUNC-004**
- **Name**: 更新团队信息
- **Priority**: P1
- **Description**: 修改团队名称、描述、领导类型。`teamId` 不可修改。
- **Input**: `{ teamId: UUID, name?: string, description?: string, leadType?: string }`
- **Output**: `Team (更新后)`
- **Acceptance Criteria**:
  - Given 修改团队名称, When 提交更新, Then 名称变更且 `updatedAt` 更新

**REQ-FUNC-005**
- **Name**: 删除团队
- **Priority**: P1
- **Description**: 删除团队及其关联的协作空间、消息历史。若存在进行中的任务，阻止删除并提示。
- **Input**: `teamId: UUID`
- **Output**: `{ success: boolean }`
- **Acceptance Criteria**:
  - Given 无进行中任务的团队, When 删除, Then 团队及关联数据全部清除
  - Given 存在进行中任务的团队, When 删除, Then 返回 409 冲突错误，列出进行中任务

**REQ-FUNC-006**
- **Name**: 添加团队成员
- **Priority**: P0
- **Description**: 从本地已加载的智能体中选择一个或多个加入团队。同一智能体可加入多个团队。
- **Input**: `{ teamId: UUID, agentIds: UUID[], roles?: string[] }`
- **Output**: `{ addedMembers: TeamMember[] }`
- **Acceptance Criteria**:
  - Given 3 个可用智能体, When 全部添加, Then 团队成员数增加 3
  - Given 智能体状态为 `error`, When 添加, Then 返回警告但允许添加(标记为 `isActive=false`)

**REQ-FUNC-007**
- **Name**: 移除团队成员
- **Priority**: P1
- **Description**: 将智能体从团队移除。若该智能体有进行中子任务，提示确认是否强制移除并重新分配。
- **Input**: `{ teamId: UUID, memberId: UUID, force?: boolean }`
- **Output**: `{ success: boolean, reassignedTasks?: UUID[] }`
- **Acceptance Criteria**:
  - Given 成员无进行中任务, When 移除, Then 直接成功
  - Given 成员有 2 个进行中子任务且 `force=true`, When 移除, Then 移除成功且 2 个子任务重新分配

**REQ-FUNC-008**
- **Name**: 团队技能概览
- **Priority**: P2
- **Description**: 聚合展示团队所有成员的技能标签分布，帮助领导快速了解团队整体能力。
- **Input**: `teamId: UUID`
- **Output**: `{ skills: { name: string, count: int, agents: string[] }[] }`
- **Acceptance Criteria**:
  - Given 团队有 5 个成员分别具备不同技能, When 查询概览, Then 返回去重聚合的技能分布

### 3.2 智能体发现与接入 (Agent Discovery)

**REQ-FUNC-009**
- **Name**: 扫描本地智能体目录
- **Priority**: P0
- **Description**: 扫描配置的本地目录(`~/.agents/`、`./agents/`)，递归发现所有包含 `AGENT.yaml` 或 `AGENT.md` 的目录，解析并加载合法智能体。
- **Input**: `{ paths?: string[] }` (默认使用配置的扫描路径)
- **Output**: `{ loaded: Agent[], warnings: { path: string, reason: string }[] }`
- **Acceptance Criteria**:
  - Given 目录下有 10 个合法智能体和 2 个非法智能体, When 扫描, Then 加载 10 个并报告 2 个警告，扫描耗时 < 5s
  - Given 同名智能体但版本不同, When 扫描, Then 仅加载版本较高者

**REQ-FUNC-010**
- **Name**: 解析智能体清单
- **Priority**: P0
- **Description**: 解析 `AGENT.yaml` 或 `AGENT.md`(YAML frontmatter)，提取：名称、版本、描述、技能列表、工具列表、输入/输出 schema、资源限制。字段定义见 [Data Requirements](#5-data-requirements)。
- **Input**: 智能体目录路径
- **Output**: `Agent` 对象或解析错误
- **Acceptance Criteria**:
  - Given 合法的 `AGENT.yaml`, When 解析, Then 所有字段正确填充
  - Given 缺少必填字段 `name` 的清单, When 解析, Then 返回明确错误指出缺失字段

**REQ-FUNC-011**
- **Name**: 热加载智能体
- **Priority**: P1
- **Description**: 运行时重新扫描目录，检测新增/移除/更新的智能体，增量更新内存中的智能体注册表。提供手动触发接口和定时自动扫描(默认 5 分钟)。
- **Input**: 无 (手动触发) 或系统定时
- **Output**: `{ added: Agent[], removed: UUID[], updated: Agent[] }`
- **Acceptance Criteria**:
  - Given 用户在扫描后新增一个智能体目录, When 调用热加载, Then 新智能体立即可用
  - Given 智能体被移除, When 热加载检测到, Then 若该智能体无进行中任务则直接卸载，否则标记为 `unavailable`

**REQ-FUNC-012**
- **Name**: 技能匹配查询
- **Priority**: P1
- **Description**: 根据任务需求(关键词/标签)搜索匹配的智能体，按匹配度排序。匹配依据：技能标签、工具名称、输入/输出 schema 相关性。
- **Input**: `{ keywords: string[], tags?: string[], limit?: int }`
- **Output**: `Agent[]` 按匹配度降序
- **Acceptance Criteria**:
  - Given 关键词"数据分析 Python", When 搜索, Then 具备 data-analysis + Python 技能的智能体排在前面

**REQ-FUNC-013**
- **Name**: 智能体状态管理
- **Priority**: P1
- **Description**: 每个已加载的智能体具有实时状态：`available`、`busy`(达到并发上限)、`unavailable`(失联)、`error`(异常)。状态变更以事件形式广播。
- **Input**: 系统内部状态变更
- **Output**: WebSocket 事件 `agent.status.changed`
- **Acceptance Criteria**:
  - Given 智能体连续 3 次心跳无响应, When 超时, Then 状态变为 `unavailable` 并触发其子任务重新分配

### 3.3 团队领导 — 分工协作 (Task Decomposition & Assignment)

**REQ-FUNC-014**
- **Name**: AI 自动任务拆解
- **Priority**: P0
- **Description**: AI 领导根据主任务描述，自动拆解为子任务列表。每个子任务应可由单个智能体独立完成。输出包含：子任务名称、描述、输入要求、期望输出 schema、预估工时、依赖关系建议。
- **Input**: `{ taskId: UUID, taskDescription: string }`
- **Output**: `{ subtasks: SubtaskDraft[] }` (SubtaskDraft 含 name, description, inputSchema, expectedOutputSchema, estimatedHours, suggestedDependencies)
- **Acceptance Criteria**:
  - Given 任务"开发用户登录系统", When AI 拆解, Then 产出 ≥4 个子任务且每个子任务有明确的独立可交付物
  - Given 任务描述为空, When 拆解, Then 返回错误

**REQ-FUNC-015**
- **Name**: 自动智能体指派
- **Priority**: P0
- **Description**: AI 领导根据子任务技能需求与团队成员能力匹配度，自动分配子任务。匹配依据：技能标签匹配度(权重 0.5)、当前负载(权重 0.3)、历史成功率(权重 0.2)。
- **Input**: `{ subtaskIds: UUID[] }`
- **Output**: `{ assignments: { subtaskId: UUID, memberId: UUID, matchScore: float }[] }`
- **Acceptance Criteria**:
  - Given 团队有 5 个成员技能各异, When 分配"数据分析"子任务, Then 具备数据分析技能的成员获得最高匹配分
  - Given 最佳匹配成员已满载, When 分配, Then 自动选择次优匹配成员

**REQ-FUNC-016**
- **Name**: 手动指派覆盖
- **Priority**: P0
- **Description**: Human 领导可手动为子任务指定执行智能体，覆盖 AI 自动分配结果。
- **Input**: `{ subtaskId: UUID, assignedTo: UUID (memberId) }`
- **Output**: `Subtask` (更新后)
- **Acceptance Criteria**:
  - Given AI 已分配子任务给成员 A, When Human 领导手动改为成员 B, Then 指派结果变为 B

**REQ-FUNC-017**
- **Name**: DAG 依赖管理
- **Priority**: P0
- **Description**: 领导定义子任务间的依赖关系，系统自动构建 DAG 并校验无环。支持三种依赖类型：finish_to_start(A完成→B开始)、start_to_start(A开始→B开始)、finish_to_finish(A完成→B完成)。
- **Input**: `{ taskId: UUID, dependencies: { fromSubtaskId: UUID, toSubtaskId: UUID, type: string }[] }`
- **Output**: `{ dag: DAG, valid: boolean, cycles?: UUID[][] }`
- **Acceptance Criteria**:
  - Given 合法依赖列表, When 提交, Then DAG 构建成功且 `valid=true`
  - Given 存在 A→B→C→A 循环依赖, When 提交, Then 返回 `valid=false` 并标出循环路径

**REQ-FUNC-018**
- **Name**: 负载均衡
- **Priority**: P1
- **Description**: AI 领导分配时考虑各成员当前负载(进行中子任务数/最大并发数)，避免单一成员过载。支持配置负载均衡策略(round-robin / least-loaded / weighted)。
- **Input**: 系统内部
- **Output**: 影响分配决策
- **Acceptance Criteria**:
  - Given 成员 A 已达并发上限, When 有新子任务需要分配, Then 不分配给 A

### 3.4 团队领导 — 进度规划 (Planning)

**REQ-FUNC-019**
- **Name**: 里程碑设置
- **Priority**: P0
- **Description**: 领导为任务设置里程碑节点，每个里程碑包含名称、关联的子任务集合、截止时间。
- **Input**: `{ taskId: UUID, milestones: { name: string, subtaskIds: UUID[], deadline: datetime }[] }`
- **Output**: `Task` (含 milestones)
- **Acceptance Criteria**:
  - Given 设置 3 个里程碑, When 查询任务详情, Then 显示里程碑及其完成状态

**REQ-FUNC-020**
- **Name**: 项目时间线生成
- **Priority**: P1
- **Description**: AI 领导根据子任务预估工时和依赖关系，自动生成项目时间线(含各子任务计划开始/结束时间)，输出结构化数据供前端渲染甘特图。
- **Input**: `taskId: UUID`
- **Output**: `{ timeline: { subtaskId: UUID, plannedStart: datetime, plannedEnd: datetime, dependencies: UUID[] }[] }`
- **Acceptance Criteria**:
  - Given 一个有依赖的子任务集, When 生成时间线, Then 下游子任务的计划开始时间 ≥ 上游计划结束时间

**REQ-FUNC-021**
- **Name**: 关键路径计算
- **Priority**: P2
- **Description**: 自动计算 DAG 的关键路径(从开始到结束的最长路径)，标记哪些子任务延期会影响整体交付时间。
- **Input**: `taskId: UUID`
- **Output**: `{ criticalPath: UUID[], totalEstimatedHours: float }`
- **Acceptance Criteria**:
  - Given 含多条路径的 DAG, When 计算关键路径, Then 返回总工时最大的路径

**REQ-FUNC-022**
- **Name**: 工时预估学习
- **Priority**: P2
- **Description**: AI 领导的工时预估模型根据历史实际工时与预估工时的偏差持续调整。偏差 > 30% 时触发模型参数更新。
- **Input**: 历史任务数据(预估 vs 实际)
- **Output**: 调整后的预估参数
- **Acceptance Criteria**:
  - Given 连续 5 次某类任务实际工时超出预估 50%, When 第 6 次预估同类任务, Then 预估工时上调

### 3.5 团队领导 — 进度读取 (Progress Monitoring)

**REQ-FUNC-023**
- **Name**: 团队任务总览
- **Priority**: P0
- **Description**: 查看团队所有进行中和近期完成的任务概览：总数、各状态计数(pending/in_progress/blocked/done/failed)、完成率百分比。
- **Input**: `teamId: UUID`
- **Output**: `{ activeTasks: int, completedToday: int, byStatus: { status: string, count: int }[], completionRate: float }`
- **Acceptance Criteria**:
  - Given 团队有 5 个进行中任务和 3 个已完成任务, When 查询总览, Then 数据准确且响应 < 500ms

**REQ-FUNC-024**
- **Name**: 子任务详细进度
- **Priority**: P0
- **Description**: 查看每个子任务的状态、实际开始时间、预估完成时间、执行智能体、进度百分比。
- **Input**: `taskId: UUID`
- **Output**: `{ subtasks: { id: UUID, status, startedAt?, estimatedCompletion?, assignedTo?, progress% }[] }`
- **Acceptance Criteria**:
  - Given 10 个子任务各有不同状态, When 查询, Then 每个子任务返回准确状态和时间

**REQ-FUNC-025**
- **Name**: 成员负载视图
- **Priority**: P1
- **Description**: 查看每个团队成员的当前工作负载：进行中任务数、排队任务数、并发上限、负载率。
- **Input**: `teamId: UUID`
- **Output**: `{ members: { memberId: UUID, activeTasks: int, queuedTasks: int, maxConcurrent: int, loadPercent: float }[] }`
- **Acceptance Criteria**:
  - Given 成员 A 有 3 个进行中任务且上限为 5, When 查询, Then `loadPercent=60%`

**REQ-FUNC-026**
- **Name**: 定期进度报告
- **Priority**: P1
- **Description**: AI 领导按可配置周期(默认每日 09:00)自动生成团队工作进度摘要，包含：周期内完成项、延期预警、当前阻塞项、下一步计划。推送到团队消息频道。
- **Input**: `teamId: UUID` (定时触发)
- **Output**: Message(进度报告)
- **Acceptance Criteria**:
  - Given 每日 09:00 定时触发, When 生成报告, Then 报告包含完整的完成/延期/阻塞汇总

**REQ-FUNC-027**
- **Name**: 实时状态推送
- **Priority**: P0
- **Description**: 子任务状态变更时，通过 WebSocket 向团队领导和相关方推送事件。事件格式：`{ type, subtaskId, oldStatus, newStatus, timestamp, metadata }`。
- **Input**: 系统内部状态变更
- **Output**: WebSocket 事件
- **Acceptance Criteria**:
  - Given 子任务从 `in_progress` 变为 `done`, When 变更发生, Then 订阅者在 2 秒内收到推送

**REQ-FUNC-028**
- **Name**: 自然语言进度查询
- **Priority**: P1
- **Description**: Human 领导可通过自然语言查询进度，如"目前项目进度如何？""哪个任务阻塞了？""张三这周完成了什么？"。系统解析意图并返回结构化答案。
- **Input**: `{ teamId: UUID, query: string }`
- **Output**: `{ answer: string, data: object }`
- **Acceptance Criteria**:
  - Given 查询"哪个任务阻塞了", When 处理, Then 返回当前所有 `blocked` 状态子任务列表

### 3.6 团队领导 — 命令下发 (Command Dispatch)

**REQ-FUNC-029**
- **Name**: 任务启动/暂停/恢复/终止
- **Priority**: P0
- **Description**: 领导对任务或子任务下发控制命令。启动：任务开始按 DAG 顺序调度执行。暂停：停止调度新子任务，但已执行的不中断。恢复：从暂停点继续。终止：所有子任务标记 `cancelled`。
- **Input**: `{ targetType: "task"|"subtask", targetId: UUID, command: "start"|"pause"|"resume"|"cancel" }`
- **Output**: `{ success: boolean, affectedSubtasks: int }`
- **Acceptance Criteria**:
  - Given 任务处于 `ready` 状态, When 启动, Then 状态变为 `in_progress` 且子任务开始调度
  - Given 任务处于 `in_progress`, When 暂停, Then 状态变为 `paused`，新子任务停止分发
  - Given 任务处于 `paused`, When 恢复, Then 状态变为 `in_progress`，继续调度
  - Given 任务处于 `in_progress`, When 终止, Then 所有未完成子任务变为 `cancelled`

**REQ-FUNC-030**
- **Name**: 子任务重新分配
- **Priority**: P1
- **Description**: 领导将子任务从当前智能体撤回，重新分配给另一个智能体。若子任务已在执行，先暂停再迁移上下文。
- **Input**: `{ subtaskId: UUID, newMemberId: UUID }`
- **Output**: `Subtask` (更新后)
- **Acceptance Criteria**:
  - Given 子任务被成员 A 执行了 50%, When 重新分配给成员 B, Then B 继承 A 的上下文和进度继续执行

**REQ-FUNC-031**
- **Name**: 优先级调整
- **Priority**: P1
- **Description**: 领导为子任务设置优先级(`urgent`/`high`/`normal`/`low`)，调度引擎按优先级排序分发。`urgent` 可抢占已调度但未开始的 `normal/low` 子任务。
- **Input**: `{ subtaskId: UUID, priority: "urgent"|"high"|"normal"|"low" }`
- **Output**: `Subtask` (更新后)
- **Acceptance Criteria**:
  - Given 子任务 A(urgent) 和 B(normal) 都在等待同一智能体, When 智能体空闲, Then A 先被分发

**REQ-FUNC-032**
- **Name**: 自然语言命令解析
- **Priority**: P2
- **Description**: Human 领导通过自然语言下发管理命令，系统解析意图并转化为对应操作。支持的命令类别：分配、暂停、催促、优先级修改。
- **Input**: `{ teamId: UUID, command: string }`
- **Output**: `{ intent: string, action: string, target: UUID, params: object, confirmation: string }`
- **Acceptance Criteria**:
  - Given 命令"让王工优先处理安全漏洞那个子任务", When 解析, Then 识别 intent=set_priority, target=安全漏洞子任务, priority=urgent, assignedTo=王工
  - Given 命令语义模糊, When 解析, Then 返回澄清问题而非执行

**REQ-FUNC-033**
- **Name**: 批量命令
- **Priority**: P2
- **Description**: 领导同时选中多个子任务或成员，批量下发命令(批量暂停、批量分配、批量设置优先级)。
- **Input**: `{ commands: { targetType, targetId, command, params }[] }`
- **Output**: `{ results: { targetId, success, error? }[] }`
- **Acceptance Criteria**:
  - Given 批量暂停 5 个子任务, When 执行, Then 全部暂停成功或逐个报告失败原因

### 3.7 团队领导 — 督促与审核 (Urging & Review)

**REQ-FUNC-034**
- **Name**: 超时自动催促
- **Priority**: P1
- **Description**: 子任务执行时间超过预估工时阈值(默认 150%)时，AI 领导自动向执行智能体发出催促提醒。提醒内容包含超时比例和新建议截止时间。
- **Input**: 系统内部(定时检查)
- **Output**: Message(催促提醒)
- **Acceptance Criteria**:
  - Given 子任务预估 1 小时, When 执行超过 1.5 小时, Then 自动发送催促消息

**REQ-FUNC-035**
- **Name**: 人工催促
- **Priority**: P1
- **Description**: Human 领导手动向指定子任务/智能体发送催促消息，可附带催促原因和新的截止时间。
- **Input**: `{ subtaskId: UUID, reason?: string, newDeadline?: datetime }`
- **Output**: `{ messageId: UUID, delivered: boolean }`
- **Acceptance Criteria**:
  - Given 领导对子任务 A 发出催促, When 提交, Then 执行智能体在其消息频道收到催促

**REQ-FUNC-036**
- **Name**: 阻塞检测与上报
- **Priority**: P1
- **Description**: AI 领导自动检测因依赖未满足而阻塞的子任务，定期汇总上报给 Human 领导，包含阻塞原因和建议解除措施。
- **Input**: 系统内部(定时检查)
- **Output**: Message(阻塞报告)
- **Acceptance Criteria**:
  - Given 子任务 C 依赖 B, B 依赖 A, A 阻塞, When 检测, Then 报告指出 C 和 B 连锁阻塞，根因是 A

**REQ-FUNC-037**
- **Name**: 输出质量审核
- **Priority**: P1
- **Description**: 领导(或指定审核智能体)审核子任务输出。审核结果：`approved` 或 `rejected_with_feedback`。驳回时附带反馈意见，子任务回到执行状态。
- **Input**: `{ subtaskId: UUID, verdict: "approved"|"rejected", feedback?: string }`
- **Output**: `Subtask` (状态更新)
- **Acceptance Criteria**:
  - Given 审核通过, When 提交, Then 子任务状态变为 `done`
  - Given 驳回并附反馈, When 提交, Then 子任务状态变为 `in_progress`，执行智能体收到反馈

**REQ-FUNC-038**
- **Name**: 催办升级
- **Priority**: P2
- **Description**: 子任务被催促超过 N 次(可配置，默认 3 次)仍未完成，自动升级通知给 Human 领导，建议人工介入。
- **Input**: 系统内部(自动计数)
- **Output**: Message(升级通知)
- **Acceptance Criteria**:
  - Given 子任务被催促 3 次仍 `in_progress`, When 第 3 次催促后, Then 向 Human 领导发送升级通知

### 3.8 协作模式 (Collaboration Modes)

**REQ-FUNC-039**
- **Name**: 消息式协作 — 智能体间消息
- **Priority**: P0
- **Description**: 智能体之间可互发消息，支持 text、json、file_ref 三种内容类型。消息路由到目标智能体的上下文。
- **Input**: `{ spaceId: UUID, senderId: UUID, targetId: UUID, contentType: string, content: object }`
- **Output**: `{ messageId: UUID, delivered: boolean }`
- **Acceptance Criteria**:
  - Given 智能体 A 发送"请求接口定义"给 B, When 发送, Then B 在其消息上下文中可见该消息

**REQ-FUNC-040**
- **Name**: 消息式协作 — 群组频道
- **Priority**: P1
- **Description**: 每个团队自动创建群组频道(所有成员可见)和子任务频道(仅相关方可见)。支持 @提及 特定成员。
- **Input**: 自动创建
- **Output**: Channel
- **Acceptance Criteria**:
  - Given 团队创建, When 初始化, Then 自动创建群组频道
  - Given 子任务创建, When 初始化, Then 自动创建对应的子任务频道

**REQ-FUNC-041**
- **Name**: 工作流式协作 — DAG 调度
- **Priority**: P0
- **Description**: 调度引擎根据 DAG 依赖关系自动调度子任务。依赖满足的子任务进入就绪队列，按优先级和智能体可用性分发执行。无依赖的子任务并行执行。
- **Input**: 系统内部(DAG + 状态变更)
- **Output**: 调度决策(分发子任务)
- **Acceptance Criteria**:
  - Given DAG 中 A→B→C 串行，D 和 E 无依赖, When 启动, Then D/E 并行开始，A 开始，B/C 等待
  - Given A 完成, When 状态变更, Then B 自动变为 `pending` 进入调度队列

**REQ-FUNC-042**
- **Name**: 工作流式协作 — 数据流转
- **Priority**: P0
- **Description**: 上游子任务的输出自动作为下游子任务的输入。系统校验输出 schema 与下游输入 schema 的兼容性，不兼容时报警。
- **Input**: 系统内部(子任务完成事件)
- **Output**: 下游子任务输入填充
- **Acceptance Criteria**:
  - Given A 输出 `{ apiSpec: {...} }`, B 声明输入需要 `apiSpec`, When A 完成, Then B 的输入自动填充 A 的输出

**REQ-FUNC-043**
- **Name**: 工作流式协作 — 条件分支
- **Priority**: P1
- **Description**: 支持基于上游输出的条件分支。例如：若代码审查通过(approved)→部署子任务激活；若驳回(rejected)→修复子任务激活。
- **Input**: 子任务完成 + 条件表达式
- **Output**: 激活对应分支
- **Acceptance Criteria**:
  - Given A 输出 `{ reviewResult: "approved" }`, 分支条件 `reviewResult == "approved"`, When A 完成, Then 部署分支激活

**REQ-FUNC-044**
- **Name**: 共享空间式协作 — 共享记忆
- **Priority**: P0
- **Description**: 团队成员可写入共享记忆(键值对)，其他成员可检索。支持语义检索(基于 embedding 向量)和精确键匹配。
- **Input**: `{ spaceId: UUID, key: string, value: object, memberId: UUID }`
- **Output**: `{ entryId: UUID }`
- **Acceptance Criteria**:
  - Given 成员 A 写入 `{ key: "api_base_url", value: "https://api.example.com" }`, When 成员 B 按 key 检索, Then 返回该值
  - Given 写入"用户画像数据", When 语义搜索"用户信息", Then 返回相关条目

**REQ-FUNC-045**
- **Name**: 共享空间式协作 — 共享文件
- **Priority**: P1
- **Description**: 团队有共享文件存储空间，成员可上传/下载文件。支持版本管理(保留最近 10 个版本)。
- **Input**: `{ spaceId: UUID, file: binary, filename: string, memberId: UUID }`
- **Output**: `{ fileId: UUID, version: int }`
- **Acceptance Criteria**:
  - Given 成员上传 `spec.md`, When 查询, Then 其他成员可下载
  - Given 文件已有 3 个版本, When 上传新版本, Then 版本变为 4

**REQ-FUNC-046**
- **Name**: 协作模式组合
- **Priority**: P0
- **Description**: 一个任务可同时启用多种协作模式。默认同时启用三种模式，领导可按需关闭。
- **Input**: `{ taskId: UUID, modes: { messaging: boolean, workflow: boolean, sharedSpace: boolean } }`
- **Output**: `Task` (更新协作配置)
- **Acceptance Criteria**:
  - Given 三种模式全开, When 任务执行, Then 消息、DAG 调度、共享记忆均正常工作互不干扰

### 3.9 任务生命周期 (Task Lifecycle)

**REQ-FUNC-047**
- **Name**: 任务状态流转
- **Priority**: P0
- **Description**: 主任务按以下状态机流转：`created → planning → ready → in_progress → reviewing → completed`。异常路径：任意状态可 → `cancelled`；`in_progress` 可 → `paused` → `in_progress`。
- **Input**: 状态变更命令
- **Output**: 状态变更事件
- **Acceptance Criteria**:
  - Given 任务 `created`, When 规划完成, Then 变为 `ready`
  - Given 任务 `in_progress`, When 所有子任务完成, Then 变为 `reviewing`
  - Given 任务 `reviewing`, When 审核通过, Then 变为 `completed`

**REQ-FUNC-048**
- **Name**: 子任务状态流转
- **Priority**: P0
- **Description**: 子任务状态机：`pending → in_progress → done`。异常路径：→ `blocked`(依赖不满足)、→ `failed`(执行异常)、→ `cancelled`(被终止)、→ `skipped`(依赖失败跳过)。
- **Input**: 状态变更事件
- **Output**: 状态变更事件 + 依赖检查
- **Acceptance Criteria**:
  - Given 子任务依赖 A 未完成, When 调度, Then 状态为 `blocked`
  - Given A 完成, When 依赖满足, Then 状态变为 `pending` 进入就绪队列

**REQ-FUNC-049**
- **Name**: 任务归档
- **Priority**: P1
- **Description**: 已完成/已取消的任务自动归档。归档内容包括：任务定义、DAG 快照、所有子任务及输出、消息历史摘要、评价。支持按时间范围查询归档。
- **Input**: `taskId: UUID` (自动触发)
- **Output**: `Archive`
- **Acceptance Criteria**:
  - Given 任务完成, When 归档, Then 所有关联数据打包存入归档存储
  - Given 归档任务, When 查询归档, Then 可完整回看任务详情

**REQ-FUNC-050**
- **Name**: 任务重放
- **Priority**: P2
- **Description**: 从归档中使用相同定义重新执行任务(可用相同或不同智能体)，用于对比测试或复现。
- **Input**: `{ archiveId: UUID, agentMapping?: { oldMemberId: UUID, newMemberId: UUID }[] }`
- **Output**: `{ newTaskId: UUID }`
- **Acceptance Criteria**:
  - Given 归档任务, When 重放, Then 创建新任务实例，DAG 结构一致

### 3.10 总结与学习 (Summary & Learning)

**REQ-FUNC-051**
- **Name**: 自动任务总结
- **Priority**: P0
- **Description**: 任务完成后，AI 领导自动生成任务总结报告。包含：任务概况、各子任务完成情况、时间统计(预估 vs 实际)、遇到的问题与解决方案、团队表现评价。
- **Input**: `taskId: UUID`
- **Output**: `{ summary: string, stats: object, issues: object[], ratings: object }`
- **Acceptance Criteria**:
  - Given 任务完成, When 生成总结, Then 包含所有子任务的完成状态和时间统计

**REQ-FUNC-052**
- **Name**: 成员表现评价
- **Priority**: P1
- **Description**: AI 领导对每个参与成员进行评价：响应速度(子任务开始延迟)、输出质量(审核通过率)、协作配合度(消息响应率)，存入成员档案。
- **Input**: `taskId: UUID`
- **Output**: `{ memberRatings: { memberId: UUID, speed: float, quality: float, collaboration: float }[] }`
- **Acceptance Criteria**:
  - Given 成员 A 完成 3 个子任务且均一次审核通过, When 评价, Then quality 评分高

**REQ-FUNC-053**
- **Name**: 经验卡片提取
- **Priority**: P1
- **Description**: AI 领导从任务执行中自动提取可复用的经验，生成结构化经验卡片。分类：`tip`(小技巧)、`pitfall`(踩坑)、`best_practice`(最佳实践)、`pattern`(成功模式)。
- **Input**: `taskId: UUID`
- **Output**: `ExperienceCard[]`
- **Acceptance Criteria**:
  - Given 任务中遇到"缺少数据源导致分析阻塞"的问题并解决, When 提取经验, Then 生成 `pitfall` 类卡片含问题和解决方案

**REQ-FUNC-054**
- **Name**: 经验库检索
- **Priority**: P1
- **Description**: 经验存入团队经验库，支持关键词检索和语义检索。新任务创建时自动推送相关经验。
- **Input**: `{ teamId: UUID, query: string, category?: string }`
- **Output**: `ExperienceCard[]`
- **Acceptance Criteria**:
  - Given 经验库有"数据分析"相关经验, When 创建数据分析任务, Then 自动检索并推送相关经验

**REQ-FUNC-055**
- **Name**: 分配策略优化
- **Priority**: P2
- **Description**: 根据历史执行数据(成功率、完成时间、质量评分)，持续优化智能体匹配权重。某智能体对某类任务成功率高且时间短，后续同类任务优先分配。
- **Input**: 历史任务数据
- **Output**: 更新匹配权重
- **Acceptance Criteria**:
  - Given 成员 A 在"代码审查"类任务连续 10 次高质量完成, When 下次分配代码审查任务, Then A 的匹配权重上升

**REQ-FUNC-056**
- **Name**: 技能演化推荐
- **Priority**: P2
- **Description**: 当团队频繁遇到某类任务但缺乏高匹配度智能体时，系统推荐为现有智能体增加相应技能或创建新的专用智能体。
- **Input**: 团队任务历史分析
- **Output**: `{ recommendations: { type: "add_skill"|"create_agent", reason: string, suggestedSkill?: string }[] }`
- **Acceptance Criteria**:
  - Given 团队 10 次需要"安全审计"技能但无匹配智能体, When 分析, Then 推荐创建具备安全审计技能的智能体

---

## 4. Non-Functional Requirements

### 4.1 性能 (Performance)

**REQ-PERF-001**
- **Priority**: P0
- **Description**: 智能体目录扫描(100 个智能体以内)应在 5 秒内完成。
- **Metric**: 扫描耗时 ≤ 5s，p95 ≤ 3s

**REQ-PERF-002**
- **Priority**: P0
- **Description**: 任务状态变更到前端展示延迟不超过 2 秒(WebSocket 推送)。
- **Metric**: 端到端延迟 p95 ≤ 2s

**REQ-PERF-003**
- **Priority**: P1
- **Description**: 团队 20 个成员、主任务 500 个子任务时，DAG 渲染和状态计算在 3 秒内完成。
- **Metric**: DAG 计算 p95 ≤ 3s

**REQ-PERF-004**
- **Priority**: P1
- **Description**: 团队内消息收发延迟不超过 1 秒。
- **Metric**: 消息路由延迟 p95 ≤ 1s

### 4.2 可用性 (Availability)

**REQ-NONF-001**
- **Priority**: P0
- **Description**: 单个智能体故障不影响团队其他成员继续执行。该智能体的进行中子任务在 30 秒内自动重新分配。
- **Metric**: 故障恢复(重新分配) ≤ 30s

**REQ-NONF-002**
- **Priority**: P1
- **Description**: 系统崩溃恢复后，所有进行中任务状态通过事件回放恢复到崩溃前状态。数据丢失窗口 ≤ 5 秒。
- **Metric**: RPO ≤ 5s，恢复时间 ≤ 60s

**REQ-NONF-003**
- **Priority**: P1
- **Description**: 核心 API(任务创建/状态查询/消息发送)可用性 ≥ 99.9%。
- **Metric**: 月度 uptime ≥ 99.9%

### 4.3 安全性 (Security)

**REQ-SEC-001**
- **Priority**: P0
- **Description**: 智能体仅能访问其被授权使用的工具和数据。智能体不能越权读取其他智能体的私有上下文。
- **Metric**: 所有跨智能体访问被拒绝且记录审计日志

**REQ-SEC-002**
- **Priority**: P1
- **Description**: 团队共享空间支持访问控制。团队可设置访问密码或成员白名单。
- **Metric**: 非白名单用户无法加入团队

**REQ-SEC-003**
- **Priority**: P1
- **Description**: 智能体清单文件中的脚本路径经过沙箱校验，防止路径遍历攻击。
- **Metric**: 所有 `../` 和绝对路径引用被拦截

**REQ-SEC-004**
- **Priority**: P2
- **Description**: 所有关键操作(创建/删除/分配/状态变更)记录不可篡改的审计日志。
- **Metric**: 审计日志覆盖率 100%

**REQ-SEC-005**
- **Priority**: P0
- **Description**: 所有 API 密钥在存储时必须使用 AES-256-GCM 加密，密钥加密密钥(KEK)存储于独立安全模块（如 HashiCorp Vault 或环境变量隔离）。运行时解密仅在内存中进行，不落盘。日志中严禁明文打印任何密钥内容。
- **Metric**: 密钥明文零泄露，加密覆盖率 100%

**REQ-SEC-006**
- **Priority**: P1
- **Description**: 每次 API 密钥使用记录审计日志：使用时间、使用智能体 ID、调用的模型、消耗 token 数。密钥的创建/更新/删除操作单独记录不可变审计日志。
- **Metric**: 密钥操作审计日志覆盖率 100%

### 4.4 可扩展性 (Scalability)

**REQ-NONF-004**
- **Priority**: P1
- **Description**: 协作模式支持插件化扩展。新增协作模式(如投票模式、竞价模式)无需修改核心调度逻辑。
- **Metric**: 新增模式仅需实现 `CollaborationMode` 接口

**REQ-NONF-005**
- **Priority**: P1
- **Description**: 智能体清单格式支持版本化(通过 `version` 字段)。系统兼容解析 v1.x 和 v2.x 清单格式。
- **Metric**: 同一扫描目录可混合不同版本清单的智能体

**REQ-NONF-006**
- **Priority**: P2
- **Description**: 预留消息集成接口，支持对接企业微信、钉钉、Slack 等外部系统。
- **Metric**: 提供 `MessageConnector` 抽象接口

### 4.5 可观测性 (Observability)

**REQ-NONF-007**
- **Priority**: P1
- **Description**: 提供团队维度统计指标：任务完成数、平均完成时间、阻塞率、成员效率、预估偏差。
- **Metric**: 统计 API 查询响应 ≤ 1s

**REQ-NONF-008**
- **Priority**: P1
- **Description**: 智能体执行日志完整记录(输入、工具调用链、输出)，支持调试模式回放。
- **Metric**: 日志保留 ≥ 30 天

---

## 5. Interface Requirements

### 5.1 REST API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/teams` | 创建团队 |
| GET | `/api/teams` | 查询团队列表 |
| GET | `/api/teams/:id` | 获取团队详情 |
| PUT | `/api/teams/:id` | 更新团队 |
| DELETE | `/api/teams/:id` | 删除团队 |
| POST | `/api/teams/:id/members` | 添加成员 |
| DELETE | `/api/teams/:id/members/:mid` | 移除成员 |
| GET | `/api/teams/:id/members` | 列出成员 |
| GET | `/api/teams/:id/stats` | 团队统计 |
| GET | `/api/agents` | 列出已加载智能体 |
| GET | `/api/agents/:id` | 智能体详情 |
| POST | `/api/agents/scan` | 触发扫描 |
| GET | `/api/agents/search` | 技能搜索智能体 |
| POST | `/api/teams/:id/tasks` | 创建主任务 |
| GET | `/api/teams/:id/tasks` | 查询任务列表 |
| GET | `/api/tasks/:id` | 任务详情 |
| POST | `/api/tasks/:id/plan` | AI 规划拆解 |
| GET | `/api/tasks/:id/dag` | 获取 DAG |
| POST | `/api/tasks/:id/start` | 启动任务 |
| POST | `/api/tasks/:id/pause` | 暂停 |
| POST | `/api/tasks/:id/resume` | 恢复 |
| POST | `/api/tasks/:id/cancel` | 终止 |
| POST | `/api/tasks/:id/subtasks` | 手动创建子任务 |
| PUT | `/api/subtasks/:id` | 更新子任务 |
| POST | `/api/subtasks/:id/reassign` | 重新分配 |
| POST | `/api/subtasks/:id/urge` | 催促 |
| POST | `/api/subtasks/:id/review` | 审核 |
| GET | `/api/tasks/:id/progress` | 任务进度 |
| GET | `/api/tasks/:id/timeline` | 时间线 |
| GET | `/api/teams/:id/space/memory` | 查询共享记忆 |
| POST | `/api/teams/:id/space/memory` | 写入共享记忆 |
| GET | `/api/teams/:id/space/messages` | 查询消息 |
| POST | `/api/teams/:id/space/messages` | 发送消息 |
| GET | `/api/tasks/:id/summary` | 获取总结 |
| GET | `/api/teams/:id/experiences` | 查询经验库 |
| POST | `/api/apikeys` | 创建 API 密钥 |
| GET | `/api/apikeys` | 查询密钥列表 |
| PUT | `/api/apikeys/:id` | 更新密钥配置 |
| DELETE | `/api/apikeys/:id` | 删除/吊销密钥 |
| GET | `/api/apikeys/:id/usage` | 查询密钥用量 |
| POST | `/api/apikeys/pools` | 创建密钥池 |
| GET | `/api/apikeys/pools` | 查询密钥池列表 |
| PUT | `/api/apikeys/pools/:id` | 更新密钥池 |
| GET | `/api/agents/:id/model` | 查询智能体当前模型配置 |
| PUT | `/api/agents/:id/model` | 更新智能体模型偏好 |
| GET | `/api/models` | 列出系统支持的模型及能力画像 |
| POST | `/api/agents/:id/model/select` | 触发最优密钥自动选择 |

### 5.2 WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `task.status.changed` | Server→Client | 主任务状态变更 |
| `subtask.status.changed` | Server→Client | 子任务状态变更 |
| `agent.status.changed` | Server→Client | 智能体状态变更 |
| `message.received` | Server→Client | 新消息到达 |
| `task.progress.updated` | Server→Client | 进度数据更新 |
| `command.issued` | Client→Server | 领导下发命令 |
| `agent.heartbeat` | Agent→Server | 智能体心跳 |

### 5.3 智能体接口 (Agent Contract)

每个智能体应支持以下内部调用接口：

**REQ-INT-001**
- **Priority**: P0
- **Description**: 智能体接收子任务时，系统通过标准化接口传递子任务上下文(任务描述、输入数据、协作空间引用、消息历史)。
- **Input Schema**: `{ subtaskId: UUID, taskDescription: string, input: object, spaceRef: object, history: Message[] }`
- **Output Schema**: `{ result: object, summary: string, confidence: float, logs: string[] }`

**REQ-INT-002**
- **Priority**: P1
- **Description**: 智能体应响应心跳检测请求，返回当前状态和负载信息。超时 3 次后标记为 `unavailable`。
- **Input**: 心跳请求(每 30s)
- **Output**: `{ status: string, activeSubtasks: int, maxConcurrent: int }`

---

## 6. Data Requirements

### 6.1 数据实体

**REQ-DATA-001** — Team (团队)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| teamId | UUID | PK, 自动生成 |
| name | string | 必填, 1-100 字符 |
| description | string | 可选, ≤ 1000 字符 |
| leadType | enum | `human` / `ai` / `dual` |
| leadAgentId | UUID? | leadType 为 ai/dual 时必填 |
| status | enum | `active` / `archived` |
| collaborationConfig | JSON | 协作模式开关配置 |
| createdAt | datetime | 自动 |
| updatedAt | datetime | 自动 |

**REQ-DATA-002** — TeamMember (团队成员)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| teamId | UUID | FK → Team |
| agentId | UUID | FK → Agent |
| role | string | 可选, 角色标签 |
| isActive | boolean | 默认 true |
| joinedAt | datetime | 自动 |

**REQ-DATA-003** — Agent (智能体)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| agentId | UUID | PK |
| name | string | 唯一(同版本号取最高) |
| version | string | SemVer |
| description | string | |
| sourcePath | string | 本地目录绝对路径 |
| skills | JSON[] | `[{name, description, tags}]` |
| tools | JSON[] | `[{name, type, path}]` |
| inputSchema | JSONSchema | |
| outputSchema | JSONSchema | |
| status | enum | `available` / `busy` / `unavailable` / `error` |
| maxConcurrent | int | 默认 3 |
| stats | JSON | 历史统计 |
| loadedAt | datetime | |
| updatedAt | datetime | |

**REQ-DATA-004** — Task (主任务)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| taskId | UUID | PK |
| teamId | UUID | FK → Team |
| name | string | 必填 |
| description | string | |
| status | enum | `created`/`planning`/`ready`/`in_progress`/`paused`/`reviewing`/`completed`/`cancelled` |
| collaborationModes | JSON | `{messaging, workflow, sharedSpace}` |
| deadline | datetime? | |
| createdBy | enum | `human` / `ai` |
| createdAt | datetime | |
| startedAt | datetime? | |
| completedAt | datetime? | |

**REQ-DATA-005** — Subtask (子任务)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| subtaskId | UUID | PK |
| taskId | UUID | FK → Task |
| name | string | 必填 |
| description | string | |
| input | JSON | 输入数据/引用 |
| expectedOutput | JSONSchema | |
| priority | enum | `urgent`/`high`/`normal`/`low` |
| status | enum | `pending`/`in_progress`/`blocked`/`done`/`failed`/`cancelled`/`skipped` |
| assignedTo | UUID? | FK → TeamMember |
| estimatedHours | float | |
| actualHours | float? | |
| retryCount | int | 默认 0 |
| maxRetries | int | 默认 3 |
| output | JSON? | 执行结果 |
| createdAt | datetime | |
| startedAt | datetime? | |
| completedAt | datetime? | |

**REQ-DATA-006** — SubtaskDependency (子任务依赖)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| fromSubtaskId | UUID | FK → Subtask |
| toSubtaskId | UUID | FK → Subtask |
| dependencyType | enum | `finish_to_start`/`start_to_start`/`finish_to_finish` |
| condition | string? | 条件表达式 |

**REQ-DATA-007** — Message (消息)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| messageId | UUID | PK |
| spaceId | UUID | FK → CollaborationSpace |
| channelId | UUID? | |
| senderType | enum | `agent`/`human`/`system` |
| senderId | UUID | |
| contentType | enum | `text`/`json`/`file_ref`/`command` |
| content | JSON | |
| createdAt | datetime | |

**REQ-DATA-008** — SharedMemoryEntry (共享记忆)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| entryId | UUID | PK |
| spaceId | UUID | FK |
| key | string | |
| value | JSON | |
| embedding | vector(1536) | 语义检索用 |
| createdBy | UUID | |
| version | int | 乐观锁 |
| updatedAt | datetime | |

**REQ-DATA-009** — ExperienceCard (经验卡片)

- **Priority**: P1

| Field | Type | Constraints |
|-------|------|-------------|
| cardId | UUID | PK |
| teamId | UUID | FK → Team |
| taskId | UUID? | FK → Task |
| title | string | |
| category | enum | `tip`/`pitfall`/`best_practice`/`pattern` |
| content | string | |
| tags | string[] | |
| embedding | vector(1536)? | |
| source | enum | `auto_extracted`/`manual` |
| createdAt | datetime | |

**REQ-DATA-010** — ApiKey (API 密钥)

- **Priority**: P0

| Field | Type | Constraints |
|-------|------|-------------|
| keyId | UUID | PK |
| provider | string | 必填，如 `openai`/`anthropic`/`deepseek` |
| keyValueEncrypted | text | AES-256-GCM 密文，必填 |
| maskedKey | string | 脱敏显示，如 `sk-...a1b2` |
| maxConcurrentUsers | int | 默认 5 |
| activeUserCount | int | 实时当前并发数，默认 0 |
| status | enum | `active`/`revoking`/`revoked`/`expired` |
| expiresAt | datetime? | 过期时间 |
| dailyCostLimit | float? | 日费用上限(USD) |
| currentDailyCost | float | 当日累计费用 |
| successRate | float | 近期成功率 0-1 |
| consecutiveFailures | int | 连续失败计数（故障摘除用） |
| note | string? | 备注 |
| createdAt | datetime | |
| updatedAt | datetime | |

**REQ-DATA-011** — KeyPool (密钥池)

- **Priority**: P1

| Field | Type | Constraints |
|-------|------|-------------|
| poolId | UUID | PK |
| name | string | 必填 |
| strategy | enum | `priority`/`round-robin`/`least-loaded` |
| keyIds | UUID[] | FK → ApiKey，按优先级排序 |
| teamId | UUID? | FK → Team，绑定团队(可选) |
| agentId | UUID? | FK → Agent，绑定智能体(可选) |
| healthCheck | JSON | `{ failureThreshold: 5, cooldownSeconds: 120 }` |
| status | enum | `active`/`paused` |
| createdAt | datetime | |
| updatedAt | datetime | |

**REQ-DATA-012** — ModelConfig (模型配置)

- **Priority**: P1

| Field | Type | Constraints |
|-------|------|-------------|
| configId | UUID | PK |
| agentId | UUID | FK → Agent，唯一 |
| preferredModel | string | 如 `claude-sonnet-4-20250514` |
| provider | string | 推断自模型名 |
| fallbackModels | JSON[] | `[{model, provider}]` 降级列表 |
| parameters | JSON | `{temperature, max_tokens, top_p}` |
| autoSelectKey | boolean | 默认 true，启用最优密钥自动选择 |
| selectedKeyId | UUID? | 当前选中的密钥 |
| modelScores | JSON | 模型能力画像评分快照 |
| updatedAt | datetime | |

**REQ-DATA-013** — ModelUsageLog (模型用量日志)

- **Priority**: P1

| Field | Type | Constraints |
|-------|------|-------------|
| logId | UUID | PK |
| agentId | UUID | FK → Agent |
| keyId | UUID | FK → ApiKey |
| model | string | 使用的模型名称 |
| subtaskId | UUID? | FK → Subtask |
| promptTokens | int | |
| completionTokens | int | |
| estimatedCost | float | 预估费用(USD) |
| latencyMs | int | 响应延迟 |
| status | enum | `success`/`error`/`rate_limited` |
| errorMessage | string? | 错误信息 |
| createdAt | datetime | |

### 6.2 AGENT.yaml 清单规范

```yaml
# 智能体清单文件 — 位于智能体根目录
name: "agent-name"            # 必需: 智能体唯一名称
version: "1.0.0"              # 必需: 语义化版本
description: "..."            # 必需: 一句话描述
capabilities:                 # 必需: 能力声明
  skills:
    - name: "skill-name"
      path: "skills/skill-dir"  # 相对路径
      description: "..."
      tags: ["标签1", "标签2"]
  tools:
    - name: "tool-name"
      path: "tools/tool.py"
      type: "python"           # python | bash | node
model:                        # 必需: AI 模型配置
  preferred:                  # 首选模型
    name: "claude-sonnet-4-20250514"
    provider: "anthropic"
  fallbacks:                  # 备选模型列表（按优先级排序）
    - name: "gpt-4o-2024-11-20"
      provider: "openai"
    - name: "deepseek-v3"
      provider: "deepseek"
  parameters:                 # 推理参数
    temperature: 0.3
    max_tokens: 4096
    top_p: 1.0
  routing:                    # 路由策略
    auto_select_key: true     # 是否自动选择最优密钥
    prefer_cheapest: false    # 是否优先选择最便宜的模型
  task_model_mapping:         # 可选: 按任务类型使用不同模型
    - task_types: ["code_review", "code_generation"]
      model: "claude-sonnet-4-20250514"
    - task_types: ["summarization", "translation"]
      model: "gpt-4o-mini"
input:                        # 必需: JSON Schema
  type: object
  required: ["task_description"]
  properties:
    task_description:
      type: string
output:                       # 必需: JSON Schema
  type: object
  required: ["result"]
  properties:
    result:
      type: string
    confidence:
      type: number
      minimum: 0
      maximum: 1
limits:                       # 可选
  max_concurrent_tasks: 3
  max_execution_time_seconds: 600
```

### 6.3 数据库索引建议

```sql
-- 高频查询索引
CREATE INDEX idx_team_status ON teams(status);
CREATE INDEX idx_task_team_status ON tasks(team_id, status);
CREATE INDEX idx_subtask_task_status ON subtasks(task_id, status);
CREATE INDEX idx_subtask_assigned ON subtasks(assigned_to, status);
CREATE INDEX idx_agent_status ON agents(status);
CREATE INDEX idx_message_space_time ON messages(space_id, created_at DESC);
CREATE INDEX idx_experience_team ON experience_cards(team_id);
CREATE INDEX idx_apikey_provider_status ON api_keys(provider, status);
CREATE INDEX idx_apikey_active_users ON api_keys(active_user_count, max_concurrent_users);
CREATE INDEX idx_keypool_team ON key_pools(team_id);
CREATE INDEX idx_usage_log_agent_time ON model_usage_logs(agent_id, created_at DESC);
CREATE INDEX idx_usage_log_key_time ON model_usage_logs(key_id, created_at DESC);
CREATE INDEX idx_model_config_agent ON model_configs(agent_id);
```

---

## 附录 A：验收标准汇总

| # | 验收条件 | 关联需求 |
|---|---------|---------|
| AC-01 | 用户 3 步内创建含 5 个智能体的团队 | REQ-FUNC-001, REQ-FUNC-006 |
| AC-02 | 扫描 10+ 智能体耗时 < 5s，非法智能体不加载 | REQ-FUNC-009 |
| AC-03 | AI 领导对"开发登录系统"拆解 ≥4 个子任务，分配合理 | REQ-FUNC-014, REQ-FUNC-015 |
| AC-04 | Human 领导可手动重新分配子任务 | REQ-FUNC-016 |
| AC-05 | 自然语言"暂停所有数据分析任务"5s 内生效 | REQ-FUNC-032, REQ-FUNC-029 |
| AC-06 | 子任务超时 150% 自动催促 | REQ-FUNC-034 |
| AC-07 | 驳回子任务后智能体收到反馈并重新执行 | REQ-FUNC-037 |
| AC-08 | 智能体 A 发送消息给 B，B 收到 | REQ-FUNC-039 |
| AC-09 | 5 个有依赖的子任务按 DAG 正确串行/并行执行 | REQ-FUNC-041 |
| AC-10 | 共享记忆写入后其他成员可检索 | REQ-FUNC-044 |
| AC-11 | 三种协作模式同时启用不冲突 | REQ-FUNC-046 |
| AC-12 | 任务完整经历 created→planning→ready→in_progress→reviewing→completed | REQ-FUNC-047 |
| AC-13 | 子任务失败后自动重分配 | REQ-FUNC-030 |
| AC-14 | 任务完成后生成含统计和经验卡片的总结 | REQ-FUNC-051, REQ-FUNC-053 |
| AC-15 | 系统崩溃重启后任务状态恢复 | REQ-NONF-002 |
| AC-16 | 智能体不可越权访问其他智能体上下文 | REQ-SEC-001 |
| AC-17 | 所有状态变更可审计追踪 | REQ-SEC-004 |
| AC-18 | 智能体声明模型偏好后执行任务使用该模型 | REQ-FUNC-057 |
| AC-19 | 首选模型不可用时自动降级到备选模型，切换 < 3s | REQ-FUNC-058 |
| AC-20 | 同一密钥并发用户达到 5 上限后新请求排队 | REQ-FUNC-061 |
| AC-21 | 3 个同提供商密钥自动选择负载最低的 | REQ-FUNC-062 |
| AC-22 | 密钥池中某密钥连续失败 5 次后被摘除 | REQ-FUNC-063 |
| AC-23 | 所有提供商密钥均不可用时全局暂停调度并告警 | REQ-FUNC-064 |
| AC-24 | API 密钥创建后仅展示一次脱敏值，存储密文 | REQ-SEC-005 |
| AC-25 | 密钥每次使用记录完整审计日志 | REQ-SEC-006 |
| AC-26 | 智能体根据子任务类型自动匹配最优模型 | REQ-FUNC-059 |

---

## 附录 B：版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|------|------|---------|------|
| 1.0.0 | 2025-07-16 | 初始版本，56 条功能需求 + 12 条非功能需求 | AI Assistant |
| 1.1.0 | 2025-07-16 | 新增 AI 模型与密钥管理模块：模型偏好声明、运行时切换、最优密钥自动选择、密钥并发限制(5用户)、密钥池管理、密钥加密(SEC-005/006)、4 个新数据实体(REQ-DATA-010~013)、12 条新 API 端点、9 条新功能需求(REQ-FUNC-057~065) | AI Assistant |

---

> **文档结束** — SRS v1.1.0。程序员可据此进行架构设计、数据库设计、接口开发和前端实现。
