import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { InventoryService } from "./inventory.service";
import { CreateInventoryItemDto } from "./dto/create-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-item.dto";
import { CreateInventoryTransactionDto } from "./dto/create-transaction.dto";

const ALL_STAFF = [Role.CLINIC_OWNER, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE, Role.ACCOUNTANT];
const STOCK_HANDLERS = [Role.CLINIC_OWNER, Role.NURSE, Role.RECEPTIONIST];

@Controller("inventory/items")
@UseGuards(TenantGuard)
@Roles(...ALL_STAFF)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("category") category?: string,
    @Query("lowStockOnly") lowStockOnly?: string,
  ) {
    return this.inventoryService.listItems(user.clinicId!, {
      category,
      lowStockOnly: lowStockOnly === "true",
    });
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.inventoryService.findOne(user.clinicId!, id);
  }

  @Post()
  @Roles(Role.CLINIC_OWNER)
  createItem(@CurrentUser() user: RequestUser, @Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.createItem(user.clinicId!, dto);
  }

  @Patch(":id")
  @Roles(Role.CLINIC_OWNER)
  updateItem(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(user.clinicId!, id, dto);
  }

  @Post(":id/transactions")
  @Roles(...STOCK_HANDLERS)
  recordTransaction(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreateInventoryTransactionDto,
  ) {
    return this.inventoryService.recordTransaction(user.clinicId!, id, user.userId, dto);
  }
}
