import { DietaryRestriction } from '../types';

export const DIETARY_RESTRICTIONS: DietaryRestriction[] = [
  {
    id: 'vegetarian',
    label: { en: 'Vegetarian', zh: '素食' },
    keywords: ['pork', 'beef', 'chicken', 'lamb', 'meat', 'bacon', 'ham', 'sausage', '猪肉', '牛肉', '鸡肉', '羊肉', '肉', '培根', '火腿', '香肠']
  },
  {
    id: 'vegan',
    label: { en: 'Vegan', zh: '纯素食' },
    keywords: ['meat', 'dairy', 'egg', 'cheese', 'milk', 'butter', 'cream', 'honey', 'pork', 'beef', 'chicken', 'fish', '肉', '奶', '蛋', '奶酪', '牛奶', '黄油', '奶油', '蜂蜜', '猪肉', '牛肉', '鸡肉', '鱼']
  },
  {
    id: 'halal',
    label: { en: 'Halal', zh: '清真' },
    keywords: ['pork', 'bacon', 'ham', 'alcohol', 'wine', 'beer', 'lard', '猪肉', '培根', '火腿', '酒', '红酒', '啤酒', '猪油']
  },
  {
    id: 'low-carb',
    label: { en: 'Low Carb', zh: '低碳水' },
    keywords: ['rice', 'noodles', 'bread', 'pasta', 'potato', 'sweet potato', 'corn', '米饭', '面条', '面包', '意面', '土豆', '红薯', '玉米']
  },
  {
    id: 'gluten-free',
    label: { en: 'Gluten-Free', zh: '无麸质' },
    keywords: ['wheat', 'bread', 'noodles', 'pasta', 'flour', 'barley', 'rye', '小麦', '面包', '面条', '意面', '面粉', '大麦', '黑麦']
  },
  {
    id: 'low-sodium',
    label: { en: 'Low Sodium', zh: '低盐' },
    keywords: ['pickled', 'cured', 'salted', 'salty', 'preserved', 'soy sauce', '腌制', '咸', '腌', '酱油', '盐渍']
  }
];

export interface AllergenOption {
  id: string;
  label: { en: string; zh: string };
  keywords: string[];
}

export const COMMON_ALLERGENS: AllergenOption[] = [
  {
    id: 'peanuts',
    label: { en: 'Peanuts', zh: '花生' },
    keywords: ['peanut', 'peanuts', '花生']
  },
  {
    id: 'tree-nuts',
    label: { en: 'Tree Nuts', zh: '坚果' },
    keywords: ['almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'pecan', 'nuts', '杏仁', '核桃', '腰果', '开心果', '榛子', '坚果']
  },
  {
    id: 'shellfish',
    label: { en: 'Shellfish', zh: '贝类' },
    keywords: ['shrimp', 'crab', 'lobster', 'clam', 'oyster', 'mussel', 'scallop', '虾', '蟹', '龙虾', '蛤', '牡蛎', '贻贝', '扇贝']
  },
  {
    id: 'soy',
    label: { en: 'Soy', zh: '大豆' },
    keywords: ['soy', 'soybean', 'tofu', 'soy sauce', 'edamame', '大豆', '豆腐', '酱油', '毛豆']
  },
  {
    id: 'dairy',
    label: { en: 'Dairy', zh: '乳制品' },
    keywords: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy', '牛奶', '奶酪', '黄油', '奶油', '酸奶', '乳制品']
  },
  {
    id: 'eggs',
    label: { en: 'Eggs', zh: '蛋类' },
    keywords: ['egg', 'eggs', '蛋', '鸡蛋']
  },
  {
    id: 'fish',
    label: { en: 'Fish', zh: '鱼类' },
    keywords: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', '鱼', '三文鱼', '金枪鱼', '鳕鱼', '罗非鱼']
  },
  {
    id: 'wheat',
    label: { en: 'Wheat', zh: '小麦' },
    keywords: ['wheat', 'flour', 'bread', 'noodles', 'pasta', '小麦', '面粉', '面包', '面条', '意面']
  }
];

export interface CuisineOption {
  id: string;
  label: { en: string; zh: string };
}

export const POPULAR_CUISINES: CuisineOption[] = [
  { id: 'chinese', label: { en: 'Chinese', zh: '中餐' } },
  { id: 'japanese', label: { en: 'Japanese', zh: '日式' } },
  { id: 'korean', label: { en: 'Korean', zh: '韩式' } },
  { id: 'western', label: { en: 'Western', zh: '西餐' } },
  { id: 'thai', label: { en: 'Thai', zh: '泰式' } },
  { id: 'italian', label: { en: 'Italian', zh: '意式' } },
  { id: 'vietnamese', label: { en: 'Vietnamese', zh: '越南菜' } },
  { id: 'indian', label: { en: 'Indian', zh: '印度菜' } }
];
