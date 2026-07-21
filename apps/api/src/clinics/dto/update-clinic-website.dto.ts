import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

class ServiceItemDto {
  @IsString() title!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() iconUrl?: string;
}

class TestimonialItemDto {
  @IsString() name!: string;
  @IsString() quote!: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
}

class FaqItemDto {
  @IsString() question!: string;
  @IsString() answer!: string;
}

export class UpdateClinicWebsiteDto {
  @IsOptional() @IsString() template?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() heroImageUrl?: string;
  @IsOptional() @IsString() aboutText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ServiceItemDto)
  servicesJson?: ServiceItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TestimonialItemDto)
  testimonialsJson?: TestimonialItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faqJson?: FaqItemDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) galleryUrls?: string[];
  @IsOptional() @IsString() googleMapsUrl?: string;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}
