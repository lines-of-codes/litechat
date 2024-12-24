import type { RecordModel } from "pocketbase";
import pb from "../pocketbase";

export const keyExchanges = pb.collection("keyexchanges");

export interface KeyExchangeModel extends RecordModel {
    chat: string;
    sender: string;
    receiver: string;
    key: string;
}