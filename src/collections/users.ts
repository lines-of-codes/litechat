import { RecordModel } from "pocketbase";

export interface UserModel extends RecordModel {
    publicKey: string;
    avatar: string;
    name: string;
    email: string;
}