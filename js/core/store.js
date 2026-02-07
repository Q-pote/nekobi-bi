import { NEKO_CITY_DATA } from "https://storage.googleapis.com/nekobi-data-bucket/neko_data.json";
export const Store = {
    get data() { return NEKO_CITY_DATA || {}; },
    get(year) { 
        const yData = this.data[year];
        if (!yData) return null;
        if (!yData.year) yData.year = year;
        return yData;
    }
};