import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/global/lib/mongodb";
import User, { UserValidationSchema } from "@/global/models/User";
import { validateData } from "@/global/lib/validate";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    // Validate request data
    const validation = await validateData(UserValidationSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      email: (validation.data as { email: string }).email,
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email already in use" },
        { status: 409 }
      );
    }

    // Create new user
    const user = new User(validation.data);
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    return NextResponse.json(
      { success: true, user: userResponse },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register user" },
      { status: 500 }
    );
  }
}
