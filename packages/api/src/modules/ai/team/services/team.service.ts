import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { Team, TeamMember, LocalAgent, LeadType } from "@buildingai/db/entities";
import { CreateTeamDto, UpdateTeamDto, TeamQueryDto } from "../dto/team.dto";
import { AddMembersDto, RemoveMemberDto, AddMemberResult, RemoveMemberResult, TeamOperationResult } from "../dto/member.dto";

@Injectable()
export class TeamService {
    private readonly logger = new Logger(TeamService.name);

    constructor(
        @InjectRepository(Team)
        private readonly teamRepository: Repository<Team>,
        @InjectRepository(TeamMember)
        private readonly memberRepository: Repository<TeamMember>,
        @InjectRepository(LocalAgent)
        private readonly agentRepository: Repository<LocalAgent>,
    ) {}

    async findAll(query: TeamQueryDto): Promise<{ items: Team[]; total: number; page: number; pageSize: number }> {
        this.logger.log(`[TeamService] 开始查询团队列表`);
        this.logger.log(`[TeamService] 查询参数: ${JSON.stringify(query)}`);
        
        try {
            const qb = this.teamRepository.createQueryBuilder("team");
            this.logger.log(`[TeamService] 创建查询构建器`);
            
            if (query.status) {
                qb.andWhere("team.status = :status", { status: query.status });
                this.logger.log(`[TeamService] 添加状态条件: status=${query.status}`);
            }
            if (query.search) {
                qb.andWhere("(team.name LIKE :search OR team.description LIKE :search)", { search: `%${query.search}%` });
                this.logger.log(`[TeamService] 添加搜索条件: search=%${query.search}%`);
            }
            
            const page = parseInt(query.page || "1");
            const pageSize = parseInt(query.pageSize || "20");
            this.logger.log(`[TeamService] 分页参数: page=${page}, pageSize=${pageSize}`);
            
            qb.skip((page - 1) * pageSize).take(pageSize);
            
            this.logger.log(`[TeamService] 执行数据库查询...`);
            const [items, total] = await qb.getManyAndCount();
            
            this.logger.log(`[TeamService] 查询完成，共 ${total} 个团队，本次返回 ${items.length} 个`);
            
            return { items, total, page, pageSize };
        } catch (error) {
            this.logger.error(`[TeamService] 查询团队列表失败: ${error.message}`);
            this.logger.error(`[TeamService] 错误堆栈: ${error.stack}`);
            throw error;
        }
    }

    async findOne(id: string): Promise<Team | null> {
        const qb = this.teamRepository.createQueryBuilder("team");
        qb.where("team.id = :id", { id });
        return qb.getOne();
    }

    async create(dto: CreateTeamDto): Promise<Team> {
        this.logger.log(`[TeamService] 开始创建团队`);
        this.logger.log(`[TeamService] 创建参数: ${JSON.stringify(dto)}`);
        
        try {
            const leadTypeValue = typeof dto.leadType === "string" ? dto.leadType as LeadType : dto.leadType;
            this.logger.log(`[TeamService] leadType转换后: ${leadTypeValue}`);
            
            const team = this.teamRepository.create({
                name: dto.name,
                description: dto.description,
                leadType: leadTypeValue,
                leadAgentId: dto.leadAgentId,
            });
            
            this.logger.log(`[TeamService] 创建Team实体: ${JSON.stringify(team)}`);
            
            this.logger.log(`[TeamService] 保存到数据库...`);
            const savedTeam = await this.teamRepository.save(team);
            
            this.logger.log(`[TeamService] 创建团队成功, ID=${savedTeam.id}, name=${savedTeam.name}`);
            
            return savedTeam;
        } catch (error) {
            this.logger.error(`[TeamService] 创建团队失败: ${error.message}`);
            this.logger.error(`[TeamService] 错误堆栈: ${error.stack}`);
            throw error;
        }
    }

    async update(id: string, updateDto: UpdateTeamDto): Promise<Team | null> {
        const qb = this.teamRepository.createQueryBuilder("team");
        qb.where("team.id = :id", { id });
        const team = await qb.getOne();
        if (!team) return null;
        
        if (updateDto.leadType !== undefined) {
            const leadTypeValue = typeof updateDto.leadType === "string" ? updateDto.leadType as LeadType : updateDto.leadType;
            updateDto.leadType = leadTypeValue;
        }
        
        Object.assign(team, updateDto);
        return this.teamRepository.save(team);
    }

    async remove(id: string): Promise<TeamOperationResult> {
        const qb = this.teamRepository.createQueryBuilder("team");
        qb.where("team.id = :id", { id });
        const team = await qb.getOne();
        if (!team) {
            return { success: false, message: "团队不存在" };
        }
        await this.teamRepository.remove(team);
        return { success: true, message: "团队已删除" };
    }

    async addMembers(teamId: string, dto: AddMembersDto): Promise<AddMemberResult[]> {
        const qb = this.teamRepository.createQueryBuilder("team");
        qb.where("team.id = :teamId", { teamId });
        const team = await qb.getOne();
        if (!team) {
            throw new Error("团队不存在");
        }

        const results: AddMemberResult[] = [];
        for (let i = 0; i < dto.agentIds.length; i++) {
            const agentId = dto.agentIds[i];
            const role = dto.roles?.[i] || "member";
            try {
                const member = this.memberRepository.create({
                    teamId: teamId,
                    agentId: agentId,
                    role: role,
                    isActive: true,
                });
                const savedMember = await this.memberRepository.save(member);
                results.push({ agentId, success: true, member: savedMember });
            } catch (error) {
                results.push({ agentId, success: false, error: "添加失败" });
            }
        }
        return results;
    }

    async removeMember(teamId: string, memberId: string, dto: RemoveMemberDto): Promise<RemoveMemberResult> {
        const qb = this.memberRepository.createQueryBuilder("member");
        qb.where("member.id = :memberId", { memberId });
        qb.andWhere("member.teamId = :teamId", { teamId });
        const member = await qb.getOne();
        if (!member) {
            return { success: false, message: "成员不存在" };
        }
        await this.memberRepository.remove(member);
        return { success: true, message: "成员已移除" };
    }

    async getMembers(teamId: string): Promise<{ id: string; agentId: string; role: string; isActive: boolean }[]> {
        const qb = this.memberRepository.createQueryBuilder("member");
        qb.where("member.teamId = :teamId", { teamId });
        const members = await qb.getMany();
        return members.map(m => ({
            id: m.id,
            agentId: m.agentId,
            role: m.role || "member",
            isActive: m.isActive
        }));
    }

    async getTeamSkills(teamId: string): Promise<{ name: string; agentIds: string[] }[]> {
        const agents = await this.getTeamAgents(teamId);
        const skillsMap = new Map<string, Set<string>>();
        for (const agent of agents) {
            if (agent.skills && Array.isArray(agent.skills)) {
                for (const skill of agent.skills) {
                    if (!skillsMap.has(skill.name)) {
                        skillsMap.set(skill.name, new Set());
                    }
                    skillsMap.get(skill.name)?.add((agent as any).id);
                }
            }
        }
        return Array.from(skillsMap.entries()).map(([name, agentIds]) => ({ name, agentIds: Array.from(agentIds) }));
    }

    async getTeamAgents(teamId: string): Promise<LocalAgent[]> {
        const qb = this.memberRepository.createQueryBuilder("member");
        qb.where("member.teamId = :teamId", { teamId });
        qb.andWhere("member.isActive = :isActive", { isActive: true });
        const members = await qb.getMany();
        const agentIds = members.map((m) => m.agentId);
        if (agentIds.length === 0) return [];
        
        const agentQb = this.agentRepository.createQueryBuilder("agent");
        agentQb.where("agent.id IN (:...agentIds)", { agentIds });
        return agentQb.getMany();
    }

    async getAgentSkills(agentId: string): Promise<any> {
        const qb = this.agentRepository.createQueryBuilder("agent");
        qb.where("agent.id = :id", { id: agentId });
        const agent = await qb.getOne();
        if (!agent) {
            throw new Error("智能体不存在");
        }
        return {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            skills: agent.skills || [],
            tools: agent.tools || [],
        };
    }

    async updateAgentSkills(agentId: string, skills: any[]): Promise<LocalAgent> {
        const qb = this.agentRepository.createQueryBuilder("agent");
        qb.where("agent.id = :id", { id: agentId });
        const agent = await qb.getOne();
        if (!agent) {
            throw new Error("智能体不存在");
        }
        agent.skills = skills;
        return this.agentRepository.save(agent);
    }
}
