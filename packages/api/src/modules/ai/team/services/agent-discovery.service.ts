import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { LocalAgent, AgentStatus } from "@buildingai/db/entities";
import { existsSync, readdirSync, statSync } from "fs";
import { join, isAbsolute } from "path";

export interface AgentDiscoveryResult {
    discovered: number;
    agents: LocalAgent[];
}

export interface HotReloadResult {
    added: number;
    removed: number;
    updated: number;
}

/**
 * 检查路径是否为绝对路径（支持 Windows 和 Unix）
 * @param path 路径字符串
 * @returns 是否为绝对路径
 */
function isAbsolutePath(path: string): boolean {
    // 移除所有不可见字符和零宽字符
    const cleanPath = path.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, '');
    
    // Unix 绝对路径：以 / 开头
    if (cleanPath.startsWith('/')) {
        return true;
    }
    
    // Windows 绝对路径：如 C:\ 或 C:/
    const windowsAbsolutePathRegex = /^[A-Za-z]:[/\\]/;
    if (windowsAbsolutePathRegex.test(cleanPath)) {
        return true;
    }
    
    // 检查 Node.js 的 isAbsolute 函数
    if (isAbsolute(cleanPath)) {
        return true;
    }
    
    return false;
}

/**
 * 清理路径中的隐藏字符
 * @param path 原始路径字符串
 * @returns 清理后的路径
 */
function cleanPath(path: string): string {
    return path
        .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, '')  // 移除零宽字符和方向控制字符
        .replace(/^\s+|\s+$/g, '');  // 移除首尾空白
}

@Injectable()
export class AgentDiscoveryService {
    private readonly logger = new Logger(AgentDiscoveryService.name);
    private readonly scanPaths: string[];

    constructor(
        @InjectRepository(LocalAgent)
        private readonly agentRepository: Repository<LocalAgent>,
    ) {
        this.scanPaths = [
            join(process.cwd(), "agents"),
            join(process.cwd(), "..", "agents"),
        ];
    }

    async searchAgents(keywords: string[], tags?: string[]): Promise<LocalAgent[]> {
        if (!keywords || keywords.length === 0) {
            return this.agentRepository.find();
        }

        const qb = this.agentRepository.createQueryBuilder("agent");
        for (let i = 0; i < keywords.length; i++) {
            const keyword = keywords[i];
            qb.orWhere(
                "agent.name LIKE :keyword" + i + " OR agent.description LIKE :keyword" + i,
                { ["keyword" + i]: `%${keyword}%` }
            );
        }
        return qb.getMany();
    }

    async scanDirectories(): Promise<{ loaded: LocalAgent[] }> {
        this.logger.log(`[scanDirectories] 开始扫描默认目录...`);
        const loaded: LocalAgent[] = [];
        
        this.logger.log(`[scanDirectories] 扫描路径: ${this.scanPaths.join(", ")}`);
        
        for (const dir of this.scanPaths) {
            this.logger.log(`[scanDirectories] 检查目录是否存在: ${dir}`);
            if (existsSync(dir)) {
                try {
                    this.logger.log(`[scanDirectories] 读取目录内容: ${dir}`);
                    const entries = readdirSync(dir);
                    this.logger.log(`[scanDirectories] 发现 ${entries.length} 个条目`);
                    
                    for (const entry of entries) {
                        const fullPath = join(dir, entry);
                        if (statSync(fullPath).isDirectory()) {
                            this.logger.log(`[scanDirectories] 尝试加载智能体: ${fullPath}`);
                            const agent = await this.loadAgentFromDirectory(fullPath, entry);
                            if (agent) {
                                this.logger.log(`[scanDirectories] 成功加载智能体: ${agent.name} (${agent.id})`);
                                loaded.push(agent);
                            } else {
                                this.logger.warn(`[scanDirectories] 无法加载智能体: ${fullPath}`);
                            }
                        }
                    }
                } catch (error) {
                    this.logger.error(`[scanDirectories] 扫描目录失败: ${dir}`, error);
                }
            } else {
                this.logger.warn(`[scanDirectories] 目录不存在: ${dir}`);
            }
        }
        
        this.logger.log(`[scanDirectories] 扫描完成，总共加载 ${loaded.length} 个智能体`);
        return { loaded };
    }

    async scanCustomDirectory(customPath: string): Promise<{ loaded: LocalAgent | null; warnings: string[] }> {
        const warnings: string[] = [];
        this.logger.log(`[scanCustomDirectory] 开始扫描目录: ${customPath}`);
        
        // 安全检查：确保路径是绝对路径且存在
        if (!customPath || typeof customPath !== "string") {
            this.logger.error(`[scanCustomDirectory] 无效的目录路径: ${customPath}`);
            warnings.push("无效的目录路径");
            return { loaded: null, warnings };
        }
        
        // 清理路径（移除零宽字符和首尾空白）
        const normalizedPath = cleanPath(customPath);
        this.logger.log(`[scanCustomDirectory] 清理后的路径: ${normalizedPath}`);
        
        // 防止路径遍历攻击
        if (normalizedPath.includes("..")) {
            this.logger.error(`[scanCustomDirectory] 路径包含非法字符(..): ${normalizedPath}`);
            warnings.push("路径包含非法字符");
            return { loaded: null, warnings };
        }
        
        // 检查是否是绝对路径（支持Windows和Unix）
        if (!isAbsolutePath(normalizedPath)) {
            this.logger.error(`[scanCustomDirectory] 不是绝对路径: ${normalizedPath}`);
            warnings.push("仅支持绝对路径");
            return { loaded: null, warnings };
        }
        
        this.logger.log(`[scanCustomDirectory] 检查路径是否存在: ${normalizedPath}`);
        if (!existsSync(normalizedPath)) {
            this.logger.error(`[scanCustomDirectory] 目录不存在: ${normalizedPath}`);
            warnings.push(`目录不存在: ${normalizedPath}`);
            return { loaded: null, warnings };
        }
        
        try {
            this.logger.log(`[scanCustomDirectory] 获取路径状态: ${normalizedPath}`);
            const stats = statSync(normalizedPath);
            if (!stats.isDirectory()) {
                this.logger.error(`[scanCustomDirectory] 指定路径不是目录: ${normalizedPath}`);
                warnings.push("指定路径不是目录");
                return { loaded: null, warnings };
            }
            
            // 获取目录名称作为智能体名称（支持Windows和Unix路径分隔符）
            const pathParts = normalizedPath.split(/[/\\]/);
            const name = pathParts.filter(Boolean).pop() || "未命名智能体";
            this.logger.log(`[scanCustomDirectory] 从目录加载智能体: ${normalizedPath}, 名称: ${name}`);
            
            const agent = await this.loadAgentFromDirectory(normalizedPath, name);
            
            if (!agent) {
                this.logger.error(`[scanCustomDirectory] 无法从目录加载智能体: ${normalizedPath}`);
                warnings.push(`无法从目录加载智能体: ${normalizedPath}`);
                return { loaded: null, warnings };
            }
            
            this.logger.log(`[scanCustomDirectory] 成功加载智能体: ${agent.id}`);
            return { loaded: agent, warnings };
        } catch (error) {
            this.logger.error(`[scanCustomDirectory] 扫描目录失败: ${error.message}`, error.stack);
            warnings.push(`扫描目录失败: ${error.message}`);
            return { loaded: null, warnings };
        }
    }

    async scanMultipleDirectories(paths: string[]): Promise<{ loaded: LocalAgent[]; warnings: { path: string; reason: string }[] }> {
        const loaded: LocalAgent[] = [];
        const warnings: { path: string; reason: string }[] = [];
        
        for (const customPath of paths) {
            const { loaded: agent, warnings: pathWarnings } = await this.scanCustomDirectory(customPath);
            if (agent) {
                loaded.push(agent);
            } else {
                warnings.push({ path: customPath, reason: pathWarnings.join("; ") });
            }
        }
        
        return { loaded, warnings };
    }

    async processUploadedAgentFiles(fileUrls: string[], fileNames: string[]): Promise<{ loaded: LocalAgent[]; warnings: string[] }> {
        this.logger.log(`[processUploadedAgentFiles] 开始处理上传的文件`);
        this.logger.log(`[processUploadedAgentFiles] 文件数量: ${fileUrls.length}`);
        
        const loaded: LocalAgent[] = [];
        const warnings: string[] = [];
        
        for (let i = 0; i < fileUrls.length; i++) {
            const fileUrl = fileUrls[i];
            const fileName = fileNames[i] || `agent_${i}`;
            
            this.logger.log(`[processUploadedAgentFiles] 处理文件 ${i + 1}/${fileUrls.length}: ${fileName}`);
            
            try {
                // 根据文件扩展名处理
                const extension = fileName.split(".").pop()?.toLowerCase();
                
                if (extension === "zip") {
                    this.logger.log(`[processUploadedAgentFiles] 跳过 ZIP 文件，需要在服务器端解压处理: ${fileName}`);
                    warnings.push(`暂不支持 ZIP 文件 ${fileName}，请上传智能体配置文件（.json, .yaml）`);
                    continue;
                }
                
                // 处理配置文件
                if (["json", "yaml", "yml"].includes(extension || "")) {
                    this.logger.log(`[processUploadedAgentFiles] 处理配置文件: ${fileName}`);
                    
                    // 下载文件内容
                    const response = await fetch(fileUrl);
                    if (!response.ok) {
                        throw new Error(`无法下载文件: ${fileUrl}`);
                    }
                    
                    const content = await response.text();
                    
                    // 解析配置文件
                    let agentConfig: any;
                    try {
                        if (extension === "json") {
                            agentConfig = JSON.parse(content);
                        } else {
                            // YAML 格式需要 yaml 库来解析，这里先简化处理
                            this.logger.warn(`[processUploadedAgentFiles] YAML 解析暂未实现: ${fileName}`);
                            warnings.push(`YAML 格式 ${fileName} 暂未支持`);
                            continue;
                        }
                    } catch (parseError) {
                        this.logger.error(`[processUploadedAgentFiles] 配置文件解析失败: ${fileName}`, parseError);
                        warnings.push(`配置文件解析失败: ${fileName}`);
                        continue;
                    }
                    
                    // 检查是否已存在
                    const qb = this.agentRepository.createQueryBuilder("agent");
                    qb.where("agent.name = :name", { name: agentConfig.name || fileName.replace(/\.(json|yaml|yml)$/, "") });
                    const existing = await qb.getOne();
                    
                    if (existing) {
                        existing.version = Date.now().toString();
                        const savedAgent = await this.agentRepository.save(existing) as LocalAgent;
                        this.logger.log(`[processUploadedAgentFiles] 更新智能体: ${savedAgent.name} (${savedAgent.id})`);
                        loaded.push(savedAgent);
                    } else {
                        // 创建新智能体
                        const agent = this.agentRepository.create({
                            name: agentConfig.name || fileName.replace(/\.(json|yaml|yml)$/, ""),
                            description: agentConfig.description || "",
                            version: agentConfig.version || "1.0.0",
                            sourcePath: fileUrl,
                            skills: [],
                            tools: [],
                            status: AgentStatus.AVAILABLE,
                            maxConcurrent: 3,
                            stats: {},
                        });
                        
                        const savedAgent = await this.agentRepository.save(agent) as LocalAgent;
                        this.logger.log(`[processUploadedAgentFiles] 成功创建智能体: ${savedAgent.name} (${savedAgent.id})`);
                        loaded.push(savedAgent);
                    }
                } else {
                    this.logger.warn(`[processUploadedAgentFiles] 不支持的文件类型: ${fileName}`);
                    warnings.push(`不支持的文件类型 ${fileName}，仅支持 .json, .yaml 配置文件`);
                }
            } catch (error: any) {
                this.logger.error(`[processUploadedAgentFiles] 处理文件失败: ${fileName}`, error);
                warnings.push(`处理文件失败 ${fileName}: ${error.message}`);
            }
        }
        
        this.logger.log(`[processUploadedAgentFiles] 处理完成，成功: ${loaded.length}, 警告: ${warnings.length}`);
        return { loaded, warnings };
    }

    async hotReload(): Promise<HotReloadResult> {
        const before = new Map((await this.agentRepository.find()).map((a) => [(a as any).id, a]));
        const { loaded } = await this.scanDirectories();
        const after = new Map(loaded.map((a) => [(a as any).id, a]));

        let added = 0;
        let removed = 0;
        let updated = 0;

        for (const [id, agent] of after) {
            if (!before.has(id)) {
                added++;
            } else {
                const beforeAgent = before.get(id)!;
                if ((beforeAgent as any).version !== (agent as any).version || (beforeAgent as any).name !== (agent as any).name) {
                    updated++;
                }
            }
        }

        for (const [id] of before) {
            if (!after.has(id)) {
                removed++;
            }
        }

        return { added, removed, updated };
    }

    async updateAgentStatus(id: string, status: AgentStatus): Promise<void> {
        const qb = this.agentRepository.createQueryBuilder("agent");
        qb.where("agent.id = :id", { id });
        const agent = await qb.getOne();
        if (agent) {
            agent.status = status;
            await this.agentRepository.save(agent);
        }
    }

    private async loadAgentFromDirectory(path: string, name: string): Promise<LocalAgent | null> {
        try {
            const qb = this.agentRepository.createQueryBuilder("agent");
            qb.where("agent.sourcePath = :path", { path });
            const existing = await qb.getOne();
            if (existing) {
                existing.version = Date.now().toString();
                return this.agentRepository.save(existing);
            }

            const agent = this.agentRepository.create({
                name,
                version: "1.0.0",
                sourcePath: path,
                skills: [],
                tools: [],
                status: AgentStatus.AVAILABLE,
                maxConcurrent: 3,
                stats: {},
            });
            return this.agentRepository.save(agent);
        } catch (error) {
            this.logger.error(`加载智能体失败: ${path}`, error);
            return null;
        }
    }
}
