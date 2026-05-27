import { Body, Delete, Get, Param, Post, Put, Query, Logger } from "@nestjs/common";
import { WebController } from "@common/decorators/controller.decorator";
import { TeamService } from "../services/team.service";
import { AgentDiscoveryService } from "../services/agent-discovery.service";
import { CreateTeamDto, UpdateTeamDto, TeamQueryDto } from "../dto/team.dto";
import { AddMembersDto, RemoveMemberDto } from "../dto/member.dto";

@WebController({ path: "teams", skipAuth: true })
export class TeamController {
    private readonly logger = new Logger(TeamController.name);
    
    constructor(
        private readonly teamService: TeamService,
        private readonly agentDiscoveryService: AgentDiscoveryService,
    ) {}

    @Post()
    async create(@Body() createDto: CreateTeamDto) {
        this.logger.log(`[TeamController] 收到创建团队请求`);
        this.logger.log(`[TeamController] 请求参数: ${JSON.stringify(createDto)}`);
        try {
            this.logger.log(`[TeamController] 调用 teamService.create()`);
            const result = await this.teamService.create(createDto);
            this.logger.log(`[TeamController] 创建团队成功，ID=${result.id}, name=${result.name}`);
            return result;
        } catch (error) {
            this.logger.error(`[TeamController] 创建团队失败: ${error.message}`);
            this.logger.error(`[TeamController] 错误堆栈: ${error.stack}`);
            throw error;
        }
    }

    @Get()
    async findAll(@Query() query: TeamQueryDto) {
        this.logger.log(`[TeamController] ==================== 收到查询团队列表请求 ====================`);
        this.logger.log(`[TeamController] 请求参数类型: ${typeof query}`);
        this.logger.log(`[TeamController] 请求参数: ${JSON.stringify(query)}`);
        try {
            this.logger.log(`[TeamController] 调用 teamService.findAll()`);
            const result = await this.teamService.findAll(query);
            this.logger.log(`[TeamController] 查询完成，total=${result.total}, page=${result.page}, pageSize=${result.pageSize}`);
            this.logger.log(`[TeamController] 返回团队数量: ${result.items?.length || 0}`);
            this.logger.log(`[TeamController] 返回数据类型: ${typeof result}`);
            return result;
        } catch (error) {
            this.logger.error(`[TeamController] 查询团队列表失败: ${error.message}`);
            this.logger.error(`[TeamController] 错误堆栈: ${error.stack}`);
            throw error;
        }
    }

    @Get(":id")
    async findOne(@Param("id") id: string) {
        return this.teamService.findOne(id);
    }

    @Put(":id")
    async update(@Param("id") id: string, @Body() updateDto: UpdateTeamDto) {
        return this.teamService.update(id, updateDto);
    }

    @Delete(":id")
    async remove(@Param("id") id: string) {
        return this.teamService.remove(id);
    }

    @Post(":id/members")
    async addMembers(@Param("id") id: string, @Body() dto: AddMembersDto) {
        return this.teamService.addMembers(id, dto);
    }

    @Delete(":id/members/:memberId")
    async removeMember(@Param("id") id: string, @Param("memberId") memberId: string, @Body() dto: RemoveMemberDto) {
        return this.teamService.removeMember(id, memberId, dto);
    }

    @Get(":id/members")
    async getMembers(@Param("id") id: string) {
        return this.teamService.getMembers(id);
    }

    @Get(":id/skills")
    async getTeamSkills(@Param("id") id: string) {
        return this.teamService.getTeamSkills(id);
    }

    @Get("agents")
    async listAgents() {
        return this.agentDiscoveryService.searchAgents([]);
    }

    @Post("agents/scan")
    async scanAgents() {
        return this.agentDiscoveryService.scanDirectories();
    }

    @Get("agents/search")
    async searchAgents(@Query("keywords") keywords: string, @Query("tags") tags?: string) {
        return this.agentDiscoveryService.searchAgents(
            keywords.split(","),
            tags ? tags.split(",") : undefined
        );
    }

    @Post("agents/scan-directory")
    async scanCustomDirectory(@Body() body: { path: string }) {
        return this.agentDiscoveryService.scanCustomDirectory(body.path);
    }

    @Post("agents/scan-directories")
    async scanMultipleDirectories(@Body() body: { paths: string[] }) {
        return this.agentDiscoveryService.scanMultipleDirectories(body.paths);
    }

    @Post("agents/upload")
    async handleUploadedAgentFiles(@Body() body: { files: string[]; fileNames: string[] }) {
        this.logger.log(`[TeamController] 收到上传的智能体文件`);
        this.logger.log(`[TeamController] 文件数量: ${body.files.length}`);
        this.logger.log(`[TeamController] 文件名: ${JSON.stringify(body.fileNames)}`);
        this.logger.log(`[TeamController] 文件 URLs: ${JSON.stringify(body.files)}`);
        
        try {
            const result = await this.agentDiscoveryService.processUploadedAgentFiles(body.files, body.fileNames);
            this.logger.log(`[TeamController] 处理完成，成功: ${result.loaded.length}, 警告: ${result.warnings.length}`);
            return result;
        } catch (error) {
            this.logger.error(`[TeamController] 处理上传文件失败: ${error.message}`, error.stack);
            throw error;
        }
    }

    @Get("agents/:agentId")
    async getAgent(@Param("agentId") agentId: string) {
        return this.teamService.getAgentSkills(agentId);
    }

    @Get("agents/:agentId/skills")
    async getAgentSkills(@Param("agentId") agentId: string) {
        return this.teamService.getAgentSkills(agentId);
    }

    @Put("agents/:agentId/skills")
    async updateAgentSkills(@Param("agentId") agentId: string, @Body() body: { skills: any[] }) {
        return this.teamService.updateAgentSkills(agentId, body.skills);
    }
}
