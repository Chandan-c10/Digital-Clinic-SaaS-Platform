import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateClinicWebsiteDto {
  @IsOptional() @IsString() template?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() heroImageUrl?: string;
  @IsOptional() @IsString() aboutText?: string;
  @IsOptional() servicesJson?: Array<{ title: string; description: string; iconUrl?: string }>;
  @IsOptional() testimonialsJson?: Array<{ name: string; quote: string; rating?: number }>;
  @IsOptional() faqJson?: Array<{ question: string; answer: string }>;
  @IsOptional() @IsArray() @IsString({ each: true }) galleryUrls?: string[];
  @IsOptional() @IsString() googleMapsUrl?: string;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}
