import { IsISO8601, IsOptional } from "class-validator";

export class AgentDashboardQueryDto {
    @IsOptional()
    @IsISO8601()
    startTime?: string;

    @IsOptional()
    @IsISO8601()
    endTime?: string;
}
