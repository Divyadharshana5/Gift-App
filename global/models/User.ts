import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  addresses: Array<{
    type: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    isDefault: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Zod schema for address validation
export const AddressSchema = z.object({
  type: z.enum(["home", "work", "other"]).default("home"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City name required"),
  state: z.string().min(2, "State name required"),
  zipCode: z.string().regex(/^\d{5,6}$/, "Valid ZIP code required"),
  isDefault: z.boolean().default(false),
});

// Zod schema for user validation
export const UserValidationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  addresses: z.array(AddressSchema).optional(),
});

// Zod schema for user login
export const UserLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide your name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    addresses: [
      {
        type: {
          type: String,
          enum: ["home", "work", "other"],
          default: "home",
        },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
    next();
  } catch (error: unknown) {
    next(error as Error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create model once (prevents model overwrite error with Next.js hot reloading)
const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
