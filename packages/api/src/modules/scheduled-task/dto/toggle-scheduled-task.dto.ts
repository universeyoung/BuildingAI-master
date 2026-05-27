import { IsBoolean } from "class-validator";

export class ToggleScheduledTaskDto {
    @IsBoolean()
    isEnabled: boolean;
}
