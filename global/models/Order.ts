import mongoose, { Schema, Document, CallbackError } from "mongoose";
import { z } from "zod";

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  recipient: {
    name: string;
    age: number;
    gender: "boy" | "girl" | "unisex";
    occasion?: string;
  };
  items: Array<{
    gift: mongoose.Types.ObjectId;
    quantity: number;
    price: number;
  }>;
  deliveryAddress: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  paymentInfo: {
    method: string;
    status: string;
    transactionId?: string;
  };
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "out_for_delivery"
    | "delivered"
    | "canceled";
  deliveryTime: Date;
  specialInstructions?: string;
  totalAmount: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  deliveryPartner?: {
    name: string;
    phone: string;
    currentLocation?: {
      lat: number;
      lng: number;
    };
  };
  tracking: Array<{
    status: string;
    timestamp: Date;
    description: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Zod schemas for order validation
export const RecipientSchema = z.object({
  name: z.string().min(2, "Recipient name must be at least 2 characters"),
  age: z.number().min(0, "Age cannot be negative"),
  gender: z.enum(["boy", "girl", "unisex"]),
  occasion: z.string().optional(),
});

export const OrderItemSchema = z.object({
  gift: z.string().min(1, "Gift ID is required"),
  quantity: z.number().positive("Quantity must be positive"),
  price: z.number().nonnegative("Price cannot be negative"),
});

export const DeliveryAddressSchema = z.object({
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().regex(/^\d{5,6}$/, "Valid ZIP code required"),
});

export const PaymentInfoSchema = z.object({
  method: z.enum([
    "credit_card",
    "debit_card",
    "upi",
    "wallet",
    "cash_on_delivery",
  ]),
  status: z
    .enum(["pending", "completed", "failed", "refunded"])
    .default("pending"),
  transactionId: z.string().optional(),
});

export const LocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const DeliveryPartnerSchema = z.object({
  name: z.string(),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  currentLocation: LocationSchema.optional(),
});

export const TrackingEventSchema = z.object({
  status: z.string().min(1, "Status is required"),
  timestamp: z.date().default(() => new Date()),
  description: z.string().optional(),
});

// Main order validation schema
export const OrderValidationSchema = z
  .object({
    user: z.string().min(1, "User ID is required"),
    recipient: RecipientSchema,
    items: z.array(OrderItemSchema).min(1, "At least one item is required"),
    deliveryAddress: DeliveryAddressSchema,
    paymentInfo: PaymentInfoSchema,
    status: z
      .enum([
        "pending",
        "confirmed",
        "preparing",
        "out_for_delivery",
        "delivered",
        "canceled",
      ])
      .default("pending"),
    deliveryTime: z.date(),
    specialInstructions: z.string().optional(),
    totalAmount: z.number().positive("Total amount must be positive"),
    deliveryFee: z.number().nonnegative("Delivery fee cannot be negative"),
    tax: z.number().nonnegative("Tax cannot be negative"),
    discount: z.number().nonnegative("Discount cannot be negative").default(0),
    deliveryPartner: DeliveryPartnerSchema.optional(),
    tracking: z.array(TrackingEventSchema).optional(),
  })
  .refine(
    (data) => {
      // Calculate total from items and verify it matches totalAmount
      const calculatedTotal = data.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const expectedTotal =
        calculatedTotal + data.deliveryFee + data.tax - data.discount;
      return Math.abs(expectedTotal - data.totalAmount) < 0.01; // Allow small rounding differences
    },
    {
      message:
        "Total amount does not match the sum of items + delivery fee + tax - discount",
      path: ["totalAmount"],
    }
  );

const OrderSchema: Schema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      name: {
        type: String,
        required: [true, "Recipient's name is required"],
      },
      age: {
        type: Number,
        required: [true, "Recipient's age is required"],
        min: 0,
      },
      gender: {
        type: String,
        enum: ["boy", "girl", "unisex"],
        required: [true, "Recipient's gender is required"],
      },
      occasion: {
        type: String,
      },
    },
    items: [
      {
        gift: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Gift",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    deliveryAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
    },
    paymentInfo: {
      method: {
        type: String,
        enum: [
          "credit_card",
          "debit_card",
          "upi",
          "wallet",
          "cash_on_delivery",
        ],
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },
      transactionId: {
        type: String,
      },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "out_for_delivery",
        "delivered",
        "canceled",
      ],
      default: "pending",
    },
    deliveryTime: {
      type: Date,
      required: true,
    },
    specialInstructions: {
      type: String,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    deliveryFee: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    deliveryPartner: {
      name: String,
      phone: String,
      currentLocation: {
        lat: Number,
        lng: Number,
      },
    },
    tracking: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        description: String,
      },
    ],
  },
  { timestamps: true }
);

// Create indexes for faster queries
OrderSchema.index({ user: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

// Pre-save validation hook
OrderSchema.pre("save", function (next) {
  try {
    // Format the data for Zod validation
    const orderData = {
      user: (this as unknown as IOrder).user.toString(),
      recipient: (this as unknown as IOrder).recipient,
      items: (this as unknown as IOrder).items.map(
        (item: {
          gift: mongoose.Types.ObjectId;
          quantity: number;
          price: number;
        }) => ({
          gift: item.gift.toString(),
          quantity: item.quantity,
          price: item.price,
        })
      ),
      deliveryAddress: this.deliveryAddress,
      paymentInfo: this.paymentInfo,
      status: this.status,
      deliveryTime: this.deliveryTime,
      specialInstructions: this.specialInstructions,
      totalAmount: this.totalAmount,
      deliveryFee: this.deliveryFee,
      tax: this.tax,
      discount: this.discount,
      deliveryPartner: this.deliveryPartner,
      tracking: this.tracking,
    };

    // Validate using Zod schema
    OrderValidationSchema.parse(orderData);
    next();
  } catch (error) {
    next(error as CallbackError);
  }
});

// Create model
const Order =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
