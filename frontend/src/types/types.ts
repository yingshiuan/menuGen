export type MenuOption = 'Recommend' | 'Spicy' | 'Vegan' | 'Vegetarian' | 'Gluten Free';

export interface MenuItem {
  No: string;
  Price: string;
  Name: string;
  Measure: string;
  ChineseName: string;
  Description?: string;
  Options: MenuOption[]; 
  Category: string;
  mainImageBase64?: string | null; //Base64-encoded string
  images?: MenuImage[];
  lastUpdated?: number;
}

export interface MenuImage {
  name: string;
  base64: string; //Base64-encoded string
}
