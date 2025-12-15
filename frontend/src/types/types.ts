export type MenuOption = 'Recommend' | 'Spicy' | 'Vegan' | 'Vegetarian' | 'GlutenFree';

export interface MenuItem {
  No: string;
  Price: string;
  Name: string;
  ChineseName: string;
  Description?: string;
  Options: MenuOption[]; 
  Category: string;
  pictureBase64?: string | null
}
