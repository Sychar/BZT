export const USER_ROLES = ["CUSTOMER", "VENDOR", "COMPANY"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CUSTOMER_TYPES = ["EMPLOYEE", "PRIVATE"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const VENDOR_TYPES = ["BAECKER", "METZGER", "RESTAURANT"] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];

export const VENDOR_VISIBILITY = ["PUBLIC", "COMPANY_ONLY"] as const;
export type VendorVisibility = (typeof VENDOR_VISIBILITY)[number];

export const VENDOR_PARTNERSHIP = ["PARTNER", "AD_ONLY"] as const;
export type VendorPartnership = (typeof VENDOR_PARTNERSHIP)[number];

export const ORDER_STATUSES = [
  "EINGEGANGEN",
  "IN_BEARBEITUNG",
  "FERTIG",
  "ABGEHOLT",
  "STORNIERT"
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRODUCT_CATEGORIES = [
  "BROT",
  "BELAG",
  "GETRAENK",
  "FLEISCH",
  "WURST",
  "SONSTIGES"
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type Vendor = {
  id: string;
  name: string;
  type: VendorType;
  address: string;
  cutoffTime: string;
  visibility?: VendorVisibility;
  partnership?: VendorPartnership;
  supportsReservations?: boolean;
};

export type Product = {
  id: string;
  vendorId: string;
  name: string;
  category: ProductCategory;
  price: string;
  unit: string;
  active: boolean;
  imageUrl?: string | null;
  isPromo: boolean;
};

export type DailyMenuItem = {
  id: string;
  menuId: string;
  name: string;
  description?: string | null;
  price: string;
  active: boolean;
};

export type DailyMenu = {
  id: string;
  vendorId: string;
  date: string;
  title: string;
  description?: string | null;
  active: boolean;
  items: DailyMenuItem[];
};

export type Reservation = {
  id: string;
  vendorId: string;
  reservationTime: string;
  partySize: number;
  note?: string | null;
  status: string;
};

export type RestaurantOrderItem = {
  id: string;
  menuItemId: string;
  qty: number;
  unitPrice: string;
  itemNote?: string | null;
};

export type RestaurantOrder = {
  id: string;
  vendorId: string;
  pickupTime: string;
  note?: string | null;
  status: OrderStatus;
  createdAt: string;
  items: RestaurantOrderItem[];
};

export type OrderItem = {
  id: string;
  productId: string;
  qty: number;
  unitPrice: string;
  itemNote?: string | null;
  product?: Product;
};

export type Order = {
  id: string;
  vendorId: string;
  pickupWindow: string;
  note?: string | null;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
};

export type DailyBatchItem = {
  productId: string;
  productName: string;
  totalQty: number;
};

export type DailyBatch = {
  vendorId: string;
  batchDate: string;
  items: DailyBatchItem[];
  orders: Order[];
};
