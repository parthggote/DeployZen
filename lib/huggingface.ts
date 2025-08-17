const HUGGINGFACE_API_BASE_URL = "https://api.endpoints.huggingface.cloud/v2";
const WHOAMI_URL = "https://huggingface.co/api/whoami-v2";

interface CreateEndpointParams {
    name: string;
    repository: string;
    framework: string;
    task: string;
    provider: {
        vendor: string;
        region: string;
    };
    compute: {
        accelerator: string;
        instance_size: string;
        instance_type: string;
        scaling: {
            minReplica: number;
            maxReplica: number;
        }
    };
    type: "protected" | "public";
}

async function getHuggingFaceNamespace(token: string): Promise<string> {
    const response = await fetch(WHOAMI_URL, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (!response.ok) {
        throw new Error("Failed to get Hugging Face namespace");
    }
    const data = await response.json();
    return data.name;
}

export async function createHuggingFaceInferenceEndpoint(params: CreateEndpointParams) {
    const token = process.env.HUGGINGFACE_API_TOKEN;
    if (!token) {
        throw new Error("HUGGINGFACE_API_TOKEN is not set");
    }

    const namespace = await getHuggingFaceNamespace(token);

    const body = {
        name: params.name,
        provider: params.provider,
        compute: params.compute,
        model: {
            repository: params.repository,
            framework: params.framework,
            task: params.task,
        },
        type: params.type,
    };

    console.log("Sending to Hugging Face API:", JSON.stringify(body, null, 2));

    const response = await fetch(`${HUGGINGFACE_API_BASE_URL}/endpoint/${namespace}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create Hugging Face endpoint: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
}

export async function getHuggingFaceInferenceEndpoint(endpointName: string) {
    const token = process.env.HUGGINGFACE_API_TOKEN;
    if (!token) {
        throw new Error("HUGGINGFACE_API_TOKEN is not set");
    }

    const namespace = await getHuggingFaceNamespace(token);

    const response = await fetch(`${HUGGINGFACE_API_BASE_URL}/endpoint/${namespace}/${endpointName}`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (!response.ok) {
        if (response.status === 404) return null;
        const errorText = await response.text();
        throw new Error(`Failed to get Hugging Face endpoint: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
}
