import {IDues} from "../interfaces/api.interface";
import { apiClient } from "./apiClient";

export async function getDues(): Promise<Array<IDues>> {
    try {
        const response = await apiClient.get('/dues');
        return response.data;
    } catch (error) {
        return [];
    }
}

export async function updateDues(duesRecord: IDues) {
    try {
        const response = await apiClient.put('/dues', duesRecord);
        return response.status;
    } catch (error) {
        return 400;
    }
}