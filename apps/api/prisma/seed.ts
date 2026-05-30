import { PrismaClient, ProductType, PricingUnit, Role, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  "Fresh Meat",
  "Seafood",
  "Vegetables",
  "Fruits",
  "Dry Goods",
  "Noodles",
  "Dairy",
  "Bakery",
  "Snacks",
  "Beverages",
  "Frozen Food",
  "Condiments",
  "Household",
  "Personal Care",
  "Baby Care",
  "Pet Care",
  "Kitchenware",
  "General Goods",
];
const suppliers = [
  { name: "FreshFarm Vietnam Co.,Ltd", contactEmail: "sales@freshfarm.vn", contactPhone: "0901000001", address: "12 Vo Van Kiet, District 1, Ho Chi Minh City" },
  { name: "Green Valley Produce", contactEmail: "contact@greenvalley.vn", contactPhone: "0901000002", address: "88 Nguyen Huu Canh, Binh Thanh, Ho Chi Minh City" },
  { name: "An Phu Fresh Food", contactEmail: "order@anphufresh.vn", contactPhone: "0901000003", address: "21 Pham Van Dong, Thu Duc, Ho Chi Minh City" },
  { name: "Mekong Seafood Supply", contactEmail: "sales@mekongseafood.vn", contactPhone: "0901000004", address: "35 Ben Binh Dong, District 8, Ho Chi Minh City" },
  { name: "Blue Ocean Seafood", contactEmail: "hello@blueocean.vn", contactPhone: "0901000005", address: "102 Tran Hung Dao, Nha Trang, Khanh Hoa" },
  { name: "VietMeat Distribution", contactEmail: "sales@vietmeat.vn", contactPhone: "0901000006", address: "19 Tan Ky Tan Quy, Tan Phu, Ho Chi Minh City" },
  { name: "Saigon Butchery Supply", contactEmail: "order@saigonbutchery.vn", contactPhone: "0901000007", address: "44 Au Co, Tan Binh, Ho Chi Minh City" },
  { name: "Dalat Clean Vegetables", contactEmail: "contact@dalatclean.vn", contactPhone: "0901000008", address: "7 Phan Dinh Phung, Da Lat, Lam Dong" },
  { name: "Tropical Fruit House", contactEmail: "sales@tropicalfruit.vn", contactPhone: "0901000009", address: "63 Le Loi, My Tho, Tien Giang" },
  { name: "Golden Grain Foods", contactEmail: "sales@goldengrain.vn", contactPhone: "0901000010", address: "123 Nguyen Trai, District 1, Ho Chi Minh City" },
  { name: "Lotus Dry Goods", contactEmail: "order@lotusdrygoods.vn", contactPhone: "0901000011", address: "15 Hai Ba Trung, District 1, Ho Chi Minh City" },
  { name: "VinaNoodle Factory", contactEmail: "sales@vinanoodle.vn", contactPhone: "0901000012", address: "2 Industrial Zone Road, Binh Duong" },
  { name: "Binh Tay Grocery Wholesale", contactEmail: "info@binhtaywholesale.vn", contactPhone: "0901000013", address: "57 Thap Muoi, District 6, Ho Chi Minh City" },
  { name: "Central Beverage Works", contactEmail: "sales@centralbeverage.vn", contactPhone: "0901000014", address: "90 Cong Hoa, Tan Binh, Ho Chi Minh City" },
  { name: "Saigon Dairy Partner", contactEmail: "contact@saigondairy.vn", contactPhone: "0901000015", address: "33 Nguyen Van Cu, District 5, Ho Chi Minh City" },
  { name: "Morning Bakery Supply", contactEmail: "order@morningbakery.vn", contactPhone: "0901000016", address: "12 Nguyen Dinh Chieu, District 3, Ho Chi Minh City" },
  { name: "Sweet Home Confectionery", contactEmail: "sales@sweethome.vn", contactPhone: "0901000017", address: "18 Ly Thuong Kiet, District 10, Ho Chi Minh City" },
  { name: "Happy Snack Trading", contactEmail: "hello@happysnack.vn", contactPhone: "0901000018", address: "70 Cach Mang Thang 8, District 3, Ho Chi Minh City" },
  { name: "NutriCare Foods", contactEmail: "sales@nutricarefoods.vn", contactPhone: "0901000019", address: "25 Hoang Van Thu, Phu Nhuan, Ho Chi Minh City" },
  { name: "PureLife Water Co.", contactEmail: "contact@purelife.vn", contactPhone: "0901000020", address: "5 Quang Trung, Go Vap, Ho Chi Minh City" },
  { name: "Sunrise Beverage Trading", contactEmail: "sales@sunrisebev.vn", contactPhone: "0901000021", address: "47 Nguyen Oanh, Go Vap, Ho Chi Minh City" },
  { name: "HomeCare Household Supply", contactEmail: "order@homecare.vn", contactPhone: "0901000022", address: "81 Le Duc Tho, Go Vap, Ho Chi Minh City" },
  { name: "BrightClean Vietnam", contactEmail: "sales@brightclean.vn", contactPhone: "0901000023", address: "60 Nguyen Xi, Binh Thanh, Ho Chi Minh City" },
  { name: "Family Essentials Co.", contactEmail: "contact@familyessentials.vn", contactPhone: "0901000024", address: "9 Pasteur, District 1, Ho Chi Minh City" },
  { name: "KitchenPro Supplies", contactEmail: "sales@kitchenpro.vn", contactPhone: "0901000025", address: "29 Dinh Tien Hoang, Binh Thanh, Ho Chi Minh City" },
  { name: "BeautyCare Distribution", contactEmail: "order@beautycare.vn", contactPhone: "0901000026", address: "101 Nguyen Thi Minh Khai, District 3, Ho Chi Minh City" },
  { name: "Natural Glow Cosmetics", contactEmail: "sales@naturalglow.vn", contactPhone: "0901000027", address: "23 Tran Quang Khai, District 1, Ho Chi Minh City" },
  { name: "FreshSmile Oral Care", contactEmail: "contact@freshsmile.vn", contactPhone: "0901000028", address: "8 Dien Bien Phu, District 3, Ho Chi Minh City" },
  { name: "BabyJoy Supplies", contactEmail: "sales@babyjoy.vn", contactPhone: "0901000029", address: "92 Nguyen Van Linh, District 7, Ho Chi Minh City" },
  { name: "PetLife Trading", contactEmail: "hello@petlife.vn", contactPhone: "0901000030", address: "13 Kha Van Can, Thu Duc, Ho Chi Minh City" },
  { name: "Frozen Choice Vietnam", contactEmail: "sales@frozenchoice.vn", contactPhone: "0901000031", address: "6 Song Hanh, Thu Duc, Ho Chi Minh City" },
  { name: "Saigon Sauce Factory", contactEmail: "contact@saigonsauce.vn", contactPhone: "0901000032", address: "77 Lac Long Quan, District 11, Ho Chi Minh City" },
  { name: "Nam Viet Spice Co.", contactEmail: "sales@namvietspice.vn", contactPhone: "0901000033", address: "16 Nguyen Thai Son, Go Vap, Ho Chi Minh City" },
  { name: "EggFarm Daily", contactEmail: "order@eggfarm.vn", contactPhone: "0901000034", address: "24 National Road 13, Binh Duong" },
  { name: "CleanRice Cooperative", contactEmail: "sales@cleanricecoop.vn", contactPhone: "0901000035", address: "3 Tran Phu, Can Tho City" },
  { name: "Viet Organic Market", contactEmail: "hello@vietorganic.vn", contactPhone: "0901000036", address: "55 Hoang Dieu, District 4, Ho Chi Minh City" },
  { name: "CoolFresh Logistics", contactEmail: "contact@coolfresh.vn", contactPhone: "0901000037", address: "11 Industrial Park, Long An" },
  { name: "Convenience Wholesale Hub", contactEmail: "sales@conveniencehub.vn", contactPhone: "0901000038", address: "40 Vo Thi Sau, District 3, Ho Chi Minh City" },
  { name: "Daily Paper Goods", contactEmail: "order@dailypaper.vn", contactPhone: "0901000039", address: "72 Bui Vien, District 1, Ho Chi Minh City" },
  { name: "Smart Home Plastics", contactEmail: "sales@smarthomeplastics.vn", contactPhone: "0901000040", address: "66 Nguyen Kiem, Phu Nhuan, Ho Chi Minh City" },
];

const usSupplierAddresses = [
  "1201 Market St, San Francisco, CA 94103",
  "233 W Washington St, Chicago, IL 60606",
  "4100 Main St, Houston, TX 77002",
  "725 5th Ave, New York, NY 10022",
  "1800 Broadway, Denver, CO 80202",
  "99 Congress St, Boston, MA 02110",
  "1414 4th Ave, Seattle, WA 98101",
  "800 N Alameda St, Los Angeles, CA 90012",
  "500 Brickell Ave, Miami, FL 33131",
  "301 E Pine St, Orlando, FL 32801",
  "400 S Las Vegas Blvd, Las Vegas, NV 89101",
  "155 W 5th St, Austin, TX 78701",
  "900 2nd Ave, Nashville, TN 37201",
  "250 W Pratt St, Baltimore, MD 21201",
  "600 Broad St, Newark, NJ 07102",
  "77 Summer St, Buffalo, NY 14202",
  "100 N Tryon St, Charlotte, NC 28202",
  "420 Peachtree St, Atlanta, GA 30308",
  "150 W Jefferson St, Phoenix, AZ 85003",
  "555 SW Oak St, Portland, OR 97204",
  "210 E Olive Way, Seattle, WA 98122",
  "340 N 3rd St, Minneapolis, MN 55401",
  "1100 Walnut St, Kansas City, MO 64106",
  "75 E Santa Clara St, San Jose, CA 95113",
  "980 Mission St, San Francisco, CA 94103",
  "240 Canal St, New Orleans, LA 70130",
  "130 King St, Charleston, SC 29401",
  "88 E Broad St, Columbus, OH 43215",
  "1450 Larimer St, Denver, CO 80202",
  "333 W Harbor Dr, San Diego, CA 92101",
  "12 N High St, Columbus, OH 43215",
  "60 W 23rd St, New York, NY 10010",
  "710 S Flower St, Los Angeles, CA 90017",
  "5600 Roswell Rd, Atlanta, GA 30342",
  "8200 Maryland Ave, St. Louis, MO 63105",
  "1700 Broadway, Oakland, CA 94612",
  "650 E Washington St, Indianapolis, IN 46204",
  "77 W Wacker Dr, Chicago, IL 60601",
  "4900 Belt Line Rd, Dallas, TX 75254",
  "200 S Biscayne Blvd, Miami, FL 33131",
];
const brands = ["FreshMart", "Daily Choice", "Green Basket", "Ocean Line", "HomePro", "Beauty Care", "Golden Grain", "PureDrop"];
const manufacturers = ["Saigon Foods Factory", "Mekong Produce Group", "Vietnam Household Co", "Lotus Cosmetics Lab", "Central Beverage Works"];
const deliveryNames = ["Nguyen Van Minh", "Tran Thi Hoa", "Le Quang Huy", "Pham Nhat Linh", "Hoang Bao An"];

type ProductSeed = {
  name: string;
  sku: string;
  type: ProductType;
  unit: PricingUnit;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  reorderLevel: number;
  categoryName: string;
  supplierName: string;
  brand?: string;
};

const productSeeds: ProductSeed[] = [
  { name: "Chicken Breast Fillet 500g", sku: "SKU-1001", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 65000, sellingPrice: 89000, currentStock: 60, reorderLevel: 12, categoryName: "Fresh Meat", supplierName: "VietMeat Distribution", brand: "VietMeat" },
  { name: "Chicken Drumstick 1kg", sku: "SKU-1002", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 72000, sellingPrice: 95000, currentStock: 45, reorderLevel: 10, categoryName: "Fresh Meat", supplierName: "Saigon Butchery Supply", brand: "VietMeat" },
  { name: "Pork Belly 500g", sku: "SKU-1003", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 85000, sellingPrice: 115000, currentStock: 38, reorderLevel: 8, categoryName: "Fresh Meat", supplierName: "Saigon Butchery Supply", brand: "Saigon Butchery" },
  { name: "Pork Shoulder 500g", sku: "SKU-1004", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 78000, sellingPrice: 105000, currentStock: 36, reorderLevel: 8, categoryName: "Fresh Meat", supplierName: "VietMeat Distribution", brand: "Saigon Butchery" },
  { name: "Lean Minced Pork 300g", sku: "SKU-1005", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 52000, sellingPrice: 72000, currentStock: 50, reorderLevel: 10, categoryName: "Fresh Meat", supplierName: "VietMeat Distribution", brand: "VietMeat" },
  { name: "Beef Shank 500g", sku: "SKU-1006", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 135000, sellingPrice: 175000, currentStock: 24, reorderLevel: 6, categoryName: "Fresh Meat", supplierName: "CoolFresh Logistics", brand: "Premium Beef" },
  { name: "Beef Tenderloin 300g", sku: "SKU-1007", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 180000, sellingPrice: 235000, currentStock: 18, reorderLevel: 5, categoryName: "Fresh Meat", supplierName: "CoolFresh Logistics", brand: "Premium Beef" },
  { name: "Pork Rib 500g", sku: "SKU-1008", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 92000, sellingPrice: 125000, currentStock: 32, reorderLevel: 8, categoryName: "Fresh Meat", supplierName: "Saigon Butchery Supply", brand: "Saigon Butchery" },
  { name: "Duck Half Cut 900g", sku: "SKU-1009", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 105000, sellingPrice: 139000, currentStock: 22, reorderLevel: 5, categoryName: "Fresh Meat", supplierName: "VietMeat Distribution", brand: "VietMeat" },
  { name: "Chicken Wings 500g", sku: "SKU-1010", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 72000, sellingPrice: 99000, currentStock: 40, reorderLevel: 10, categoryName: "Fresh Meat", supplierName: "Saigon Butchery Supply", brand: "VietMeat" },
  { name: "Fresh Tiger Prawn 500g", sku: "SKU-1011", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 145000, sellingPrice: 189000, currentStock: 26, reorderLevel: 6, categoryName: "Seafood", supplierName: "Mekong Seafood Supply", brand: "Mekong Seafood" },
  { name: "Salmon Fillet 250g", sku: "SKU-1012", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 155000, sellingPrice: 219000, currentStock: 20, reorderLevel: 5, categoryName: "Seafood", supplierName: "Blue Ocean Seafood", brand: "Blue Ocean" },
  { name: "Fresh Squid 500g", sku: "SKU-1013", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 98000, sellingPrice: 135000, currentStock: 30, reorderLevel: 7, categoryName: "Seafood", supplierName: "Blue Ocean Seafood", brand: "Blue Ocean" },
  { name: "Mackerel Fish 700g", sku: "SKU-1014", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 85000, sellingPrice: 119000, currentStock: 24, reorderLevel: 6, categoryName: "Seafood", supplierName: "Mekong Seafood Supply", brand: "Mekong Seafood" },
  { name: "Tilapia Fish 1kg", sku: "SKU-1015", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 62000, sellingPrice: 85000, currentStock: 28, reorderLevel: 7, categoryName: "Seafood", supplierName: "Mekong Seafood Supply", brand: "Mekong Seafood" },
  { name: "Clam Pack 1kg", sku: "SKU-1016", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 45000, sellingPrice: 65000, currentStock: 35, reorderLevel: 8, categoryName: "Seafood", supplierName: "Mekong Seafood Supply", brand: "Mekong Seafood" },
  { name: "Sea Bass Fillet 400g", sku: "SKU-1017", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 125000, sellingPrice: 169000, currentStock: 18, reorderLevel: 5, categoryName: "Seafood", supplierName: "Blue Ocean Seafood", brand: "Blue Ocean" },
  { name: "Frozen Basa Fillet 500g", sku: "SKU-1018", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 59000, sellingPrice: 79000, currentStock: 50, reorderLevel: 10, categoryName: "Seafood", supplierName: "Frozen Choice Vietnam", brand: "Frozen Choice" },
  { name: "Crab Stick 250g", sku: "SKU-1019", type: ProductType.FRESH_FOOD, unit: PricingUnit.G, costPrice: 32000, sellingPrice: 45000, currentStock: 60, reorderLevel: 12, categoryName: "Seafood", supplierName: "Frozen Choice Vietnam", brand: "Frozen Choice" },
  { name: "Fish Ball 500g", sku: "SKU-1020", type: ProductType.FRESH_FOOD, unit: PricingUnit.G, costPrice: 42000, sellingPrice: 59000, currentStock: 55, reorderLevel: 12, categoryName: "Seafood", supplierName: "CoolFresh Logistics", brand: "Frozen Choice" },
  { name: "Dalat Lettuce 300g", sku: "SKU-1021", type: ProductType.FRESH_FOOD, unit: PricingUnit.G, costPrice: 12000, sellingPrice: 19000, currentStock: 70, reorderLevel: 15, categoryName: "Vegetables", supplierName: "Dalat Clean Vegetables", brand: "Dalat Clean" },
  { name: "Green Cabbage 1kg", sku: "SKU-1022", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 18000, sellingPrice: 28000, currentStock: 65, reorderLevel: 15, categoryName: "Vegetables", supplierName: "FreshFarm Vietnam Co.,Ltd", brand: "FreshFarm" },
  { name: "Tomato 500g", sku: "SKU-1023", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 16000, sellingPrice: 25000, currentStock: 80, reorderLevel: 18, categoryName: "Vegetables", supplierName: "Green Valley Produce", brand: "FreshFarm" },
  { name: "Carrot 500g", sku: "SKU-1024", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 14000, sellingPrice: 22000, currentStock: 75, reorderLevel: 15, categoryName: "Vegetables", supplierName: "Dalat Clean Vegetables", brand: "Dalat Clean" },
  { name: "Potato 1kg", sku: "SKU-1025", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 22000, sellingPrice: 34000, currentStock: 60, reorderLevel: 12, categoryName: "Vegetables", supplierName: "Green Valley Produce", brand: "Green Valley" },
  { name: "Cucumber 500g", sku: "SKU-1026", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 12000, sellingPrice: 20000, currentStock: 70, reorderLevel: 15, categoryName: "Vegetables", supplierName: "FreshFarm Vietnam Co.,Ltd", brand: "FreshFarm" },
  { name: "Morning Glory 300g", sku: "SKU-1027", type: ProductType.FRESH_FOOD, unit: PricingUnit.G, costPrice: 8000, sellingPrice: 14000, currentStock: 90, reorderLevel: 20, categoryName: "Vegetables", supplierName: "Green Valley Produce", brand: "Green Valley" },
  { name: "Spinach 300g", sku: "SKU-1028", type: ProductType.FRESH_FOOD, unit: PricingUnit.G, costPrice: 10000, sellingPrice: 17000, currentStock: 70, reorderLevel: 15, categoryName: "Vegetables", supplierName: "Dalat Clean Vegetables", brand: "Dalat Clean" },
  { name: "Broccoli 500g", sku: "SKU-1029", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 26000, sellingPrice: 39000, currentStock: 45, reorderLevel: 10, categoryName: "Vegetables", supplierName: "Dalat Clean Vegetables", brand: "Dalat Clean" },
  { name: "Mushroom Pack 200g", sku: "SKU-1030", type: ProductType.FRESH_FOOD, unit: PricingUnit.G, costPrice: 18000, sellingPrice: 29000, currentStock: 40, reorderLevel: 10, categoryName: "Vegetables", supplierName: "Viet Organic Market", brand: "Viet Organic" },
  { name: "Banana Bunch 1kg", sku: "SKU-1031", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 18000, sellingPrice: 29000, currentStock: 65, reorderLevel: 15, categoryName: "Fruits", supplierName: "Tropical Fruit House", brand: "Tropical Fruit" },
  { name: "Dragon Fruit 1kg", sku: "SKU-1032", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 25000, sellingPrice: 39000, currentStock: 55, reorderLevel: 12, categoryName: "Fruits", supplierName: "Tropical Fruit House", brand: "Tropical Fruit" },
  { name: "Orange 1kg", sku: "SKU-1033", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 32000, sellingPrice: 49000, currentStock: 60, reorderLevel: 12, categoryName: "Fruits", supplierName: "FreshFarm Vietnam Co.,Ltd", brand: "FreshFarm" },
  { name: "Apple Fuji 1kg", sku: "SKU-1034", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 65000, sellingPrice: 89000, currentStock: 40, reorderLevel: 8, categoryName: "Fruits", supplierName: "Convenience Wholesale Hub", brand: "Imported Fruit" },
  { name: "Pear 1kg", sku: "SKU-1035", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 59000, sellingPrice: 79000, currentStock: 35, reorderLevel: 8, categoryName: "Fruits", supplierName: "Convenience Wholesale Hub", brand: "Imported Fruit" },
  { name: "Watermelon Whole", sku: "SKU-1036", type: ProductType.FRESH_FOOD, unit: PricingUnit.PIECE, costPrice: 45000, sellingPrice: 69000, currentStock: 30, reorderLevel: 6, categoryName: "Fruits", supplierName: "Tropical Fruit House", brand: "Tropical Fruit" },
  { name: "Mango Cat Chu 1kg", sku: "SKU-1037", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 38000, sellingPrice: 59000, currentStock: 45, reorderLevel: 10, categoryName: "Fruits", supplierName: "Tropical Fruit House", brand: "Tropical Fruit" },
  { name: "Grape Seedless 500g", sku: "SKU-1038", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 78000, sellingPrice: 109000, currentStock: 28, reorderLevel: 6, categoryName: "Fruits", supplierName: "Convenience Wholesale Hub", brand: "Imported Fruit" },
  { name: "Guava 1kg", sku: "SKU-1039", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 22000, sellingPrice: 35000, currentStock: 55, reorderLevel: 12, categoryName: "Fruits", supplierName: "Tropical Fruit House", brand: "Tropical Fruit" },
  { name: "Avocado 1kg", sku: "SKU-1040", type: ProductType.FRESH_FOOD, unit: PricingUnit.KG, costPrice: 45000, sellingPrice: 69000, currentStock: 32, reorderLevel: 8, categoryName: "Fruits", supplierName: "Viet Organic Market", brand: "Viet Organic" },
  { name: "Golden Grain Rice 5kg", sku: "SKU-1041", type: ProductType.DRY_GOODS, unit: PricingUnit.BOX, costPrice: 120000, sellingPrice: 145000, currentStock: 50, reorderLevel: 10, categoryName: "Dry Goods", supplierName: "Golden Grain Foods", brand: "Golden Grain" },
  { name: "Jasmine Rice 5kg", sku: "SKU-1042", type: ProductType.DRY_GOODS, unit: PricingUnit.BOX, costPrice: 130000, sellingPrice: 159000, currentStock: 45, reorderLevel: 10, categoryName: "Dry Goods", supplierName: "CleanRice Cooperative", brand: "CleanRice" },
  { name: "ST25 Premium Rice 5kg", sku: "SKU-1043", type: ProductType.DRY_GOODS, unit: PricingUnit.BOX, costPrice: 185000, sellingPrice: 229000, currentStock: 30, reorderLevel: 8, categoryName: "Dry Goods", supplierName: "CleanRice Cooperative", brand: "CleanRice" },
  { name: "Glutinous Rice 2kg", sku: "SKU-1044", type: ProductType.DRY_GOODS, unit: PricingUnit.KG, costPrice: 58000, sellingPrice: 79000, currentStock: 40, reorderLevel: 8, categoryName: "Dry Goods", supplierName: "Golden Grain Foods", brand: "Golden Grain" },
  { name: "Red Bean 500g", sku: "SKU-1045", type: ProductType.DRY_GOODS, unit: PricingUnit.G, costPrice: 25000, sellingPrice: 39000, currentStock: 60, reorderLevel: 12, categoryName: "Dry Goods", supplierName: "Lotus Dry Goods", brand: "Lotus Dry" },
  { name: "Green Bean 500g", sku: "SKU-1046", type: ProductType.DRY_GOODS, unit: PricingUnit.G, costPrice: 24000, sellingPrice: 38000, currentStock: 65, reorderLevel: 12, categoryName: "Dry Goods", supplierName: "Lotus Dry Goods", brand: "Lotus Dry" },
  { name: "Peanut 500g", sku: "SKU-1047", type: ProductType.DRY_GOODS, unit: PricingUnit.G, costPrice: 28000, sellingPrice: 43000, currentStock: 60, reorderLevel: 12, categoryName: "Dry Goods", supplierName: "Lotus Dry Goods", brand: "Lotus Dry" },
  { name: "All Purpose Flour 1kg", sku: "SKU-1048", type: ProductType.DRY_GOODS, unit: PricingUnit.KG, costPrice: 22000, sellingPrice: 35000, currentStock: 70, reorderLevel: 15, categoryName: "Dry Goods", supplierName: "Lotus Dry Goods", brand: "Lotus Dry" },
  { name: "Sugar White 1kg", sku: "SKU-1049", type: ProductType.DRY_GOODS, unit: PricingUnit.KG, costPrice: 19000, sellingPrice: 29000, currentStock: 80, reorderLevel: 20, categoryName: "Dry Goods", supplierName: "Binh Tay Grocery Wholesale", brand: "Binh Tay" },
  { name: "Salt Iodized 500g", sku: "SKU-1050", type: ProductType.DRY_GOODS, unit: PricingUnit.G, costPrice: 6000, sellingPrice: 10000, currentStock: 100, reorderLevel: 25, categoryName: "Dry Goods", supplierName: "Nam Viet Spice Co.", brand: "Nam Viet" },
];

const random = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000);

const buildExpandedProducts = (base: ProductSeed[], target = 200): ProductSeed[] => {
  if (base.length >= target) return base.slice(0, target);
  const out = [...base];
  let index = base.length + 1;
  while (out.length < target) {
    const src = base[out.length % base.length];
    const skuNumber = 1000 + index;
    out.push({
      ...src,
      name: src.name,
      sku: `SKU-${skuNumber}`,
    });
    index += 1;
  }
  return out;
};

async function main() {
  await prisma.inventoryTransaction.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash("Password123!", 10);
  const [admin, manager, warehouse, cashier, sale, finance] = await Promise.all([
    prisma.user.create({ data: { email: "admin@supermarket.test", name: "Admin User", role: Role.ADMIN, passwordHash: hash } }),
    prisma.user.create({ data: { email: "manager@supermarket.test", name: "Manager User", role: Role.MANAGER, passwordHash: hash } }),
    prisma.user.create({ data: { email: "warehouse@supermarket.test", name: "Warehouse User", role: Role.WAREHOUSE_STAFF, passwordHash: hash } }),
    prisma.user.create({ data: { email: "cashier@supermarket.test", name: "Cashier User", role: Role.CASHIER, passwordHash: hash } }),
    prisma.user.create({ data: { email: "sales@supermarket.test", name: "Sales User", role: "SALE_DEPARTMENT" as any, passwordHash: hash } }),
    prisma.user.create({ data: { email: "finance@supermarket.test", name: "Finance User", role: "FINANCE_DEPARTMENT" as any, passwordHash: hash } }),
  ]);

  const catRows = await Promise.all(categories.map((name) => prisma.category.create({ data: { name } })));
  const warehouseRows = await Promise.all([
    prisma.warehouse.create({ data: { name: "Main Warehouse", code: "WH-MAIN", address: "1201 Market St, San Francisco, CA 94103", isActive: true } }),
    prisma.warehouse.create({ data: { name: "Cold Storage", code: "WH-COLD", address: "233 W Washington St, Chicago, IL 60606", isActive: true } }),
    prisma.warehouse.create({ data: { name: "Reserve Warehouse", code: "WH-RESERVE", address: "4100 Main St, Houston, TX 77002", isActive: true } }),
  ]);
  const supRows = await Promise.all(
    suppliers.map((supplier, index) =>
      prisma.supplier.create({
        data: {
          ...supplier,
          address: usSupplierAddresses[index] ?? supplier.address,
        },
      }),
    ),
  );
  const categoryMap = new Map(catRows.map((c) => [c.name, c.id]));
  const supplierMap = new Map(supRows.map((s) => [s.name, s.id]));

  const expandedProducts = buildExpandedProducts(productSeeds, 200);
  const products = [];

  for (const seed of expandedProducts) {
    const categoryId = categoryMap.get(seed.categoryName);
    const supplierId = supplierMap.get(seed.supplierName);
    if (!categoryId) throw new Error(`Missing category: ${seed.categoryName}`);
    if (!supplierId) throw new Error(`Missing supplier: ${seed.supplierName}`);

    const expiryDate = seed.type === ProductType.DRY_GOODS || seed.type === ProductType.HOUSEHOLD
      ? daysFromNow(180 + Math.floor(Math.random() * 360))
      : daysFromNow(7 + Math.floor(Math.random() * 120));
    const productionDate = daysFromNow(-30 - Math.floor(Math.random() * 120));
    const cost = Number(seed.costPrice);
    const sell = Number(seed.sellingPrice);

    const created = await prisma.product.create({
      data: {
        name: seed.name,
        brand: seed.brand || random(brands),
        manufacturer: random(manufacturers),
        sku: seed.sku,
        barcode: `893${seed.sku.replace("SKU-", "").padStart(8, "0")}`,
        type: seed.type,
        unit: seed.unit,
        costPrice: cost,
        sellingPrice: sell,
        profitMargin: cost > 0 ? (((sell - cost) / cost) * 100).toFixed(2) : 0,
        currentStock: seed.currentStock,
        reorderLevel: seed.reorderLevel,
        productionDate,
        expiryDate,
        expiryStatus: expiryDate < new Date() ? "EXPIRED" : expiryDate <= daysFromNow(3) ? "ALERT_3" : expiryDate <= daysFromNow(15) ? "WARNING_15" : "NORMAL",
        categoryId,
        supplierId,
        createdById: admin.id,
      },
    });
    products.push(created);
  }

  for (let i = 0; i < 200; i++) {
    const p = random(products);
    const type = random([TransactionType.IN, TransactionType.OUT, TransactionType.ADJUSTMENT, TransactionType.DESTROY]);
    const qty = +(Math.random() * 5 + 1).toFixed(3);
    const delta = type === "IN" || type === "ADJUSTMENT" ? qty : -qty;
    await prisma.product.update({ where: { id: p.id }, data: { currentStock: { increment: delta } } });
    const tx = await prisma.inventoryTransaction.create({
      data: {
        productId: p.id,
        type,
        quantity: qty,
        unitPrice: Number(p.costPrice),
        totalValue: qty * Number(p.costPrice),
        invoiceNumber: type === "IN" ? `INV-${new Date().getFullYear()}-${String(i + 1).padStart(5, "0")}` : undefined,
        supplierName: type === "IN" ? random(supRows).name : undefined,
        deliveredByName: type === "IN" ? random(deliveryNames) : undefined,
        deliveredAt: type === "IN" ? daysFromNow(-Math.floor(Math.random() * 20)) : undefined,
        reason: type === "ADJUSTMENT" ? "Periodic count correction" : undefined,
        destroyReason: type === "DESTROY" ? "DAMAGED" : undefined,
        performedById: random([admin, manager, warehouse, cashier, sale, finance]).id,
        warehouseId: random(warehouseRows).id,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: `INVENTORY_${type}`,
        entity: "InventoryTransaction",
        entityId: tx.id,
        userId: tx.performedById,
        after: tx as any,
      },
    });
  }
}

main().finally(async () => prisma.$disconnect());
