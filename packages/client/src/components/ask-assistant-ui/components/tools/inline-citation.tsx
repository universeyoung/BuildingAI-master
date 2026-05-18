"use client";

import {
  InlineCitation as InlineCitationRoot,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationSource,
} from "@buildingai/ui/components/ai-elements/inline-citation";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { HoverCardTrigger } from "@buildingai/ui/components/ui/hover-card";
import { memo, useMemo } from "react";

import type { KnowledgeReferenceItem } from "./knowledge-references";

export interface InlineCitationProps {
  index: number;
  references: KnowledgeReferenceItem[];
}

export const InlineCitation = memo(function InlineCitation({
  index,
  references,
}: InlineCitationProps) {
  const ref = useMemo(() => references.find((r) => r.index === index), [references, index]);

  if (!ref) {
    return <sup className="text-muted-foreground text-[10px]">[{index}]</sup>;
  }

  const title = ref.title || ref.source || "Unknown";
  const url = ref.href ?? ref.sourceUrl;

  return (
    <InlineCitationRoot>
      <InlineCitationCard>
        <HoverCardTrigger asChild>
          <Badge className="ml-1 rounded-full" variant="secondary">
            {index}
          </Badge>
        </HoverCardTrigger>
        <InlineCitationCardBody>
          <InlineCitationCarousel>
            <InlineCitationCarouselHeader>
              <InlineCitationCarouselPrev />
              <InlineCitationCarouselNext />
              <InlineCitationCarouselIndex />
            </InlineCitationCarouselHeader>
            <InlineCitationCarouselContent>
              <InlineCitationCarouselItem>
                <InlineCitationSource description={ref.content} title={title} url={url} />
              </InlineCitationCarouselItem>
            </InlineCitationCarouselContent>
          </InlineCitationCarousel>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitationRoot>
  );
});
