import {IBrother} from "../interfaces/api.interface";

const a = require('axios');

const axios = a.create({
    baseURL: 'http://localhost:8080'
});

export async function getAllBrothers(): Promise<Array<IBrother>> {
    try {
        const response = await axios.get('/brothers');
        return response.data;
    } catch (error) {
        return [];
    }
}