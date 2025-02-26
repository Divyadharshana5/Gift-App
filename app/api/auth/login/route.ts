import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/global/lib/mongodb";
import User, { UserLoginSchema } from "@/global/models/User";
import { validateData } from "@/global/lib/validate";
import jwt from "jsonwebtoken";

// If you're using NextAuth, this route might not be necessary
// But it's useful if you want a JWT-based login endpoint
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    // Validate login data with Zod
    const validation = await validateData(UserLoginSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const { email, password } = validation.data as {
      email: string;
      password: string;
    };

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Compare password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "your-default-secret-key",
      { expiresIn: "7d" }
    );

    // User data to return (excluding password)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };

    // Set cookie with the token
    const response = NextResponse.json({
      success: true,
      user: userData,
      token,
    });

    // Set HTTP-only cookie (more secure than localStorage)
    response.cookies.set({
      name: "giftAppToken",
      value: token,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Error during login:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
