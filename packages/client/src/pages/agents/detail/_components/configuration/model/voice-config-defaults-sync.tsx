import { getSpeechConfig, type SpeechTtsModelConfig } from "@buildingai/ai-sdk/config/audio";
import { useAiProvidersQuery } from "@buildingai/services/web";
import type { VoiceConfig } from "@buildingai/types";
import { useEffect, useMemo } from "react";

interface VoiceConfigDefaultsSyncProps {
  voiceConfig: VoiceConfig | null;
  onSync: (config: VoiceConfig) => void;
}

export function VoiceConfigDefaultsSync({ voiceConfig, onSync }: VoiceConfigDefaultsSyncProps) {
  const { data: voiceProviders = [] } = useAiProvidersQuery({
    supportedModelTypes: ["speech2text", "tts"],
  });

  const { modelIdToProviderId, modelIdToModelKey } = useMemo(() => {
    const byProvider = new Map<string, string>();
    const byKey = new Map<string, string>();
    voiceProviders.forEach((p) => {
      p.models?.forEach((m) => {
        byProvider.set(m.id, p.provider);
        byKey.set(m.id, m.model);
      });
    });
    return { modelIdToProviderId: byProvider, modelIdToModelKey: byKey };
  }, [voiceProviders]);

  const ttsDefaults = useMemo(() => {
    const tts = voiceConfig?.tts;
    if (!tts?.modelId || !voiceProviders.length) return null;
    const modelKey = modelIdToModelKey.get(tts.modelId);
    const providerId = modelIdToProviderId.get(tts.modelId);
    if (!modelKey || !providerId) return null;
    const config = getSpeechConfig(providerId);
    const ttsModelConfig = config?.tts.models.find(
      (m: SpeechTtsModelConfig) => m.modelId === modelKey,
    );
    if (!ttsModelConfig) return null;
    const defaultVoiceId = ttsModelConfig.defaultVoiceId ?? ttsModelConfig.voices?.[0]?.id;
    const defaultSpeed = ttsModelConfig.defaultSpeed ?? 1;
    const speedRange = ttsModelConfig.speedRange ?? [0.25, 4];
    const voiceIds = ttsModelConfig.voices?.map((v: { id: string }) => v.id) ?? [];
    return { defaultVoiceId, defaultSpeed, speedRange, voiceIds };
  }, [voiceConfig?.tts?.modelId, voiceProviders, modelIdToProviderId, modelIdToModelKey]);

  useEffect(() => {
    const tts = voiceConfig?.tts;
    if (!tts?.modelId || !ttsDefaults) return;
    const voiceInvalid =
      tts.voiceId != null &&
      ttsDefaults.voiceIds.length > 0 &&
      !ttsDefaults.voiceIds.includes(tts.voiceId);
    const needVoice = (tts.voiceId == null && ttsDefaults.defaultVoiceId) || voiceInvalid;
    const speedOutOfRange =
      tts.speed != null &&
      (tts.speed < ttsDefaults.speedRange[0] || tts.speed > ttsDefaults.speedRange[1]);
    const needSpeed = tts.speed == null || speedOutOfRange;
    if (!needVoice && !needSpeed) return;
    const nextTts = {
      modelId: tts.modelId,
      voiceId: needVoice ? (ttsDefaults.defaultVoiceId ?? undefined) : tts.voiceId,
      speed: needSpeed ? ttsDefaults.defaultSpeed : tts.speed,
    };
    onSync({
      ...voiceConfig,
      tts: nextTts,
    });
  }, [voiceConfig, ttsDefaults, onSync]);

  return null;
}
