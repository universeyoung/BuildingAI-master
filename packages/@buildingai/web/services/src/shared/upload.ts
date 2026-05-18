import type { AxiosProgressEvent } from "axios";

import { apiHttpClient } from "../base";

export type UploadFileResult = {
    id: string;
    url: string;
    originalName: string;
    size: number;
    mimeType: string;
    extension: string;
};

export type UploadFileParams = {
    description?: string;
    extensionId?: string;
};

export type UploadRequestOptions = {
    onUploadProgress?: (event: AxiosProgressEvent) => void;
};

export async function uploadFile(
    file: File,
    params?: UploadFileParams,
    options?: UploadRequestOptions,
): Promise<UploadFileResult> {
    const formData = new FormData();
    formData.append("file", file);
    if (params?.description) {
        formData.append("description", params.description);
    }
    if (params?.extensionId) {
        formData.append("extensionId", params.extensionId);
    }

    return apiHttpClient.post<UploadFileResult>("/upload/file", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
        onUploadProgress: options?.onUploadProgress,
    });
}

export async function uploadFiles(
    files: File[],
    params?: UploadFileParams,
    options?: UploadRequestOptions,
): Promise<UploadFileResult[]> {
    const formData = new FormData();
    files.forEach((file) => {
        formData.append("files", file);
    });
    if (params?.description) {
        formData.append("description", params.description);
    }
    if (params?.extensionId) {
        formData.append("extensionId", params.extensionId);
    }

    return apiHttpClient.post<UploadFileResult[]>("/upload/files", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
        onUploadProgress: options?.onUploadProgress,
    });
}

/**
 * Upload file during system initialization (no authentication required)
 * Only available when system is not initialized
 */
export async function uploadInitFile(
    file: File,
    params?: UploadFileParams,
    options?: UploadRequestOptions,
): Promise<UploadFileResult> {
    const formData = new FormData();
    formData.append("file", file);
    if (params?.description) {
        formData.append("description", params.description);
    }

    return apiHttpClient.post<UploadFileResult>("/upload/init-file", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
        onUploadProgress: options?.onUploadProgress,
    });
}

export function detectFileType(mimeType: string): "image" | "video" | "file" {
    if (mimeType.startsWith("image/")) {
        return "image";
    }
    if (mimeType.startsWith("video/")) {
        return "video";
    }
    return "file";
}
