import {IRevenue} from "../interfaces/api.interface";

const a = require('axios');

const axios = a.create({
    baseURL: 'http://localhost:8080'
});

export async function getRevenue() {
    try {
        const response = axios.get('/revenue');
        return response.data;
    } catch (error) {
        return [];
    }
}

export async function addRevenue(revenue: IRevenue) {
    try {
        const response = axios.post('/revenue', revenue);
        return response.status;
    } catch (error) {
        return 400;
    }
}