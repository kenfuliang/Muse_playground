import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  CreateInspectionInput,
  RecordResultInput,
  DisposeNgInput,
  createInspectionSchema,
  recordResultSchema,
  disposeNgSchema,
} from '@brainfactory/shared';
import { CurrentUser, JwtAuthGuard, requireAdmin, type AuthUser } from '../common/auth.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { QcService } from './qc.service.js';

/**
 * QC 品檢 — v1 只有 ADMIN（生管）可用。
 * 角色體系（品檢員）在 phase 2 細化。
 */
@UseGuards(JwtAuthGuard)
@Controller('qc')
export class QcController {
  constructor(private readonly qc: QcService) {}

  @Post('inspections')
  createInspection(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createInspectionSchema)) body: CreateInspectionInput,
  ) {
    requireAdmin(user);
    return this.qc.createInspection(user, body);
  }

  @Get('pending')
  pending(@CurrentUser() user: AuthUser) {
    requireAdmin(user);
    return this.qc.pendingInspections();
  }

  @Post('inspections/:id/result')
  recordResult(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(recordResultSchema)) body: RecordResultInput,
  ) {
    requireAdmin(user);
    return this.qc.recordResult(user, id, body);
  }

  @Post('ng-records/:id/dispose')
  disposeNg(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(disposeNgSchema)) body: DisposeNgInput,
  ) {
    requireAdmin(user);
    return this.qc.disposeNg(user, id, body);
  }

  @Get('ng-records')
  ngRecords(@CurrentUser() user: AuthUser) {
    requireAdmin(user);
    return this.qc.ngRecords();
  }
}
