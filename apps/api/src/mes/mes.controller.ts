import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import {
  CreateWorkOrderInput,
  ReportProductionInput,
  createWorkOrderSchema,
  reportProductionSchema,
} from '@brainfactory/shared';
import { CurrentUser, JwtAuthGuard, requireAdmin, type AuthUser } from '../common/auth.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { MesService } from './mes.service.js';

@UseGuards(JwtAuthGuard)
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly mes: MesService) {}

  @Get('my')
  my(@CurrentUser() user: AuthUser) {
    return this.mes.myWorkOrders(user);
  }

  @Get(':id')
  one(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mes.getWorkOrder(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createWorkOrderSchema)) body: CreateWorkOrderInput,
  ) {
    requireAdmin(user);
    return this.mes.createWorkOrder(user, body);
  }

  @Post(':id/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mes.start(user, id);
  }

  @Post(':id/report')
  report(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(reportProductionSchema)) body: ReportProductionInput,
  ) {
    // Header 優先於 body；兩者都沒有也沒關係（不強制）
    return this.mes.report(user, id, { ...body, idempotencyKey: idempotencyKey ?? body.idempotencyKey });
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mes.complete(user, id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller()
export class MastersController {
  constructor(private readonly mes: MesService) {}

  @Get('machines')
  machines() {
    return this.mes.listMachines();
  }

  @Get('molds')
  molds() {
    return this.mes.listMolds();
  }

  @Get('molds/maintenance-due')
  due(@CurrentUser() user: AuthUser) {
    requireAdmin(user);
    return this.mes.maintenanceDue();
  }

  @Post('molds/:id/maintain')
  maintain(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    requireAdmin(user);
    return this.mes.recordMaintenance(user, id, body?.note);
  }
}
