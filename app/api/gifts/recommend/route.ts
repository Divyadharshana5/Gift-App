import { connectToDatabase } from "@/global/lib/mongodb";
import Gift, { GiftRecommendationQuerySchema } from "@/global/models/Gift";
import { NextRequest, NextResponse } from "next/server";
import { validateData } from "@/global/lib/validate";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    // Extract query parameters
    const queryParams = {
      age: searchParams.get("age") || "0",
      gender: searchParams.get("gender") || "unisex",
    };

    // Validate query parameters
    const validation = await validateData(GiftRecommendationQuerySchema, {
      age: queryParams.age,
      gender: queryParams.gender,
    });

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const { age, gender } = validation.data as {
      age: number;
      gender: string;
    };

    await connectToDatabase();

    // Find gifts that match the age range and gender
    const gifts = await Gift.find({
      "ageRange.min": { $lte: age },
      "ageRange.max": { $gte: age },
      $or: [{ gender }, { gender: "unisex" }],
      inStock: true,
      stockCount: { $gt: 0 },
      estimatedDeliveryTime: { $lte: 60 }, // Delivery within 1 hour
    })
      .sort({ isPopular: -1, rating: -1 })
      .limit(10);

    // Get additional recommendations if we don't have enough
    if (gifts.length < 5) {
      const additionalGifts = await Gift.find({
        "ageRange.min": { $lte: age + 2 },
        "ageRange.max": { $gte: age - 2 },
        $or: [{ gender }, { gender: "unisex" }],
        inStock: true,
        stockCount: { $gt: 0 },
        estimatedDeliveryTime: { $lte: 60 }, // Delivery within 1 hour
        _id: { $nin: gifts.map((g) => g._id) }, // Exclude gifts we already have
      })
        .sort({ isPopular: -1, rating: -1 })
        .limit(10 - gifts.length);

      gifts.push(...additionalGifts);
    }

    return NextResponse.json({
      success: true,
      gifts,
      timestamp: new Date().toISOString(),
      metadata: {
        age,
        gender,
        count: gifts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching gift recommendations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch gift recommendations" },
      { status: 500 }
    );
  }
}
