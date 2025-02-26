import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/global/lib/mongodb";
import Gift, { GiftValidationSchema } from "@/global/models/Gift";
import { validateData } from "@/global/lib/validate";
import { AuthOptions, getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { Session } from "next-auth";

type CustomSession = Session & {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const gift = await Gift.findById(params.id);

    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, gift });
  } catch (error) {
    console.error("Error fetching gift:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch gift" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    // Check authentication (admin only operation)
    const session = (await getServerSession(
      authOptions as unknown as AuthOptions
    )) as CustomSession;
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Find gift
    const gift = await Gift.findById(params.id);
    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }

    // Validate incoming data
    const body = await req.json();
    const validation = await validateData(GiftValidationSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // Update gift
    Object.assign(gift, validation.data);
    await gift.save();

    return NextResponse.json({ success: true, gift });
  } catch (error) {
    console.error("Error updating gift:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update gift" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    // Check authentication (admin only operation)
    const session = (await getServerSession(
      authOptions as unknown as AuthOptions
    )) as CustomSession;
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const gift = await Gift.findByIdAndDelete(params.id);

    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Gift deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting gift:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete gift" },
      { status: 500 }
    );
  }
}
