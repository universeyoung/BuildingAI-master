import { apiHttpClient } from "./base";

export function getHello() {
    return apiHttpClient.get<{ message: string }>("/hello");
}
