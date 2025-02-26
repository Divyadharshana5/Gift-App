import mongoose, { Schema, Document } from "mongoose";
import { z } from "zod";

export interface IGift extends Document {
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  ageRange: {
    min: number;
    max: number;
  };
  gender: "boy" | "girl" | "unisex";
  tags: string[];
  inStock: boolean;
  stockCount: number;
  estimatedDeliveryTime: number; // in minutes
  rating: number;
  reviews: Array<{
    userId: mongoose.Types.ObjectId;
    rating: number;
    comment: string;
    date: Date;
  }>;
  isPopular: boolean;
  discount: number; // percentage
  createdAt: Date;
  updatedAt: Date;
}

// Zod schema for review validation
export const ReviewSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  date: z.date().default(() => new Date()),
});

// Zod schema for age range validation
export const AgeRangeSchema = z.object({
  min: z.number().min(0, "Minimum age cannot be negative"),
  max: z
    .number()
    .min(
      z.number().min(0) as unknown as number,
      "Maximum age must be greater than or equal to minimum age"
    ),
});

// Zod schema for gift validation
export const GiftValidationSchema = z.object({
  name: z.string().min(2, "Gift name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().positive("Price must be positive"),
  images: z
    .array(z.string().url("Valid image URL required"))
    .min(1, "At least one image is required"),
  category: z.enum([
    "toys",
    "books",
    "clothes",
    "electronics",
    "art",
    "outdoors",
    "accessories",
    "educational",
    "other",
  ]),
  ageRange: AgeRangeSchema.refine((data) => data.max >= data.min, {
    message: "Maximum age must be greater than or equal to minimum age",
    path: ["max"],
  }),
  gender: z.enum(["boy", "girl", "unisex"]).default("unisex"),
  tags: z.array(z.string()).optional(),
  inStock: z.boolean().default(true),
  stockCount: z.number().nonnegative().default(0),
  estimatedDeliveryTime: z
    .number()
    .max(60, "Delivery time must be within 1 hour")
    .default(60),
  rating: z.number().min(0).max(5).default(0),
  reviews: z.array(ReviewSchema).optional(),
  isPopular: z.boolean().default(false),
  discount: z.number().min(0).max(100).default(0),
});

// Zod schema for gift recommendation query
export const GiftRecommendationQuerySchema = z.object({
  age: z.coerce.number().min(0, "Age cannot be negative"),
  gender: z.enum(["boy", "girl", "unisex"]),
});

const GiftSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Gift name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Gift description is required"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    images: {
      type: [String],
      required: [true, "At least one image is required"],
      validate: [
        (val: string[]) => val.length > 0,
        "At least one image is required",
      ],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "toys",
        "books",
        "clothes",
        "electronics",
        "art",
        "outdoors",
        "accessories",
        "educational",
        "other",
      ],
    },
    ageRange: {
      min: {
        type: Number,
        required: true,
        min: 0,
      },
      max: {
        type: Number,
        required: true,
        validate: {
          validator: function (this: Document, val: number) {
            return (
              val >=
              (this as unknown as { ageRange: { min: number } }).ageRange.min
            );
          },
          message: "Maximum age must be greater than or equal to minimum age",
        },
      },
    },
    gender: {
      type: String,
      enum: ["boy", "girl", "unisex"],
      default: "unisex",
    },
    tags: [String],
    inStock: {
      type: Boolean,
      default: true,
    },
    stockCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedDeliveryTime: {
      type: Number,
      default: 60, // default 60 minutes for 1 hour delivery
      max: [60, "Delivery time must be within 1 hour"],
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        comment: String,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isPopular: {
      type: Boolean,
      default: false,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

// Create indexes for faster queries
GiftSchema.index({ gender: 1, "ageRange.min": 1, "ageRange.max": 1 });
GiftSchema.index({ category: 1 });
GiftSchema.index({ tags: 1 });
GiftSchema.index({ isPopular: -1 });

const Gift = mongoose.models.Gift || mongoose.model<IGift>("Gift", GiftSchema);

export default Gift;
