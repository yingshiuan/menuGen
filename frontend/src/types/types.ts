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
  pictureBase64?: string | null
}
