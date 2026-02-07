import { NEKO_CITY_DATA } from '../data/data.js';
export const Store = {
    get data() { return NEKO_CITY_DATA || {}; },
    get(year) { 
        const yData = this.data[year];
        if (!yData) return null;
        if (!yData.year) yData.year = year;
        return yData;
    }
};