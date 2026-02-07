// import { NEKO_CITY_DATA } from "https://storage.googleapis.com/nekobi-data-bucket/neko_data.json";

let _data = null;

export async function loadData() {
  const res = await fetch(
    "https://storage.googleapis.com/nekobi-data-bucket/neko_data.json"
  );
  _data = await res.json();
}

export const Store = {
  get data() { return _data || {}; },

  get(year) {
    const yData = this.data[year];
    if (!yData) return null;
    if (!yData.year) yData.year = year;
    return yData;
  }
};
