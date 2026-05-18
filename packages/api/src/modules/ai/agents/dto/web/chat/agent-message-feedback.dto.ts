import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAgentMessageFeedbackDto {
    @IsIn(["like", "dislike"])
    type: "like" | "dislike";

    @IsOptional()
    @IsString()
    @MaxLength(100)
    dislikeReason?: string;
}
