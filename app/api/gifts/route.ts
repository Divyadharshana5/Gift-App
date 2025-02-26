import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/global/lib/mongodb";
import Gift, { GiftValidationSchema, IGift } from "@/global/models/Gift";
import { validateData } from "@/global/lib/validate";
import { AuthOptions, getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { Session } from "next-auth";
import { FilterQuery, SortOrder } from "mongoose";

type CustomSession = Session & {
  user?: {
    id: string;
  };
};

export async function POST(req: NextRequest) {
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

    // Validate incoming data
    const body = await req.json();
    const validation = await validateData(GiftValidationSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // Create new gift
    const gift = new Gift(validation.data);
    await gift.save();

    return NextResponse.json({ success: true, gift }, { status: 201 });
  } catch (error) {
    console.error("Error creating gift:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create gift" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;

    // Build query based on search parameters
    const query: FilterQuery<IGift> = { inStock: true };

    // Filter by category if provided
    if (searchParams.has("category")) {
      query.category = searchParams.get("category");
    }

    // Filter by gender if provided
    if (searchParams.has("gender")) {
      const gender = searchParams.get("gender");
      if (["boy", "girl", "unisex"].includes(gender as string)) {
        query.$or = [{ gender }, { gender: "unisex" }];
      }
    }

    // Filter by age range if provided
    if (searchParams.has("age")) {
      const age = parseInt(searchParams.get("age") || "0");
      if (age > 0) {
        query["ageRange.min"] = { $lte: age };
        query["ageRange.max"] = { $gte: age };
      }
    }

    // Price range filter
    if (searchParams.has("minPrice")) {
      const minPrice = parseFloat(searchParams.get("minPrice") || "0");
      if (minPrice > 0) query.price = { ...query.price, $gte: minPrice };
    }

    if (searchParams.has("maxPrice")) {
      const maxPrice = parseFloat(searchParams.get("maxPrice") || "0");
      if (maxPrice > 0) {
        query.price = { ...query.price, $lte: maxPrice };
      }
    }

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Sort options
    const sort: { [key: string]: SortOrder } = {};
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    sort[sortBy] = sortOrder;

    // Fetch gifts with pagination
    const gifts = await Gift.find(query).sort(sort).skip(skip).limit(limit);

    // Get total count for pagination metadata
    const totalGifts = await Gift.countDocuments(query);

    return NextResponse.json({
      success: true,
      gifts,
      pagination: {
        total: totalGifts,
        page,
        limit,
        pages: Math.ceil(totalGifts / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching gifts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch gifts" },
      { status: 500 }
    );
  }
}
