import pb from "./pocketbase";

export const users = pb.collection("users");

export async function authWithPassword(email: string, password: string) {
    return await users.authWithPassword(email, password);
}

export async function authWithGoogle() {
    return await users.authWithOAuth2({ provider: "google" });
}
