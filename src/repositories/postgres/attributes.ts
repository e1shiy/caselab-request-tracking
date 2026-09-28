export const siteColumns = [
  'id',
  'name',
  'code',
  'region',
  'latitude',
  'longitude',
  'createdAt',
  'updatedAt',
] as const;

export const equipmentColumns = [
  'id',
  'siteId',
  'name',
  'type',
  'serialNumber',
  'latitude',
  'longitude',
  'status',
  'installedAt',
  'createdAt',
  'updatedAt',
] as const;

export const equipmentPassportColumns = [
  'equipmentId',
  'manufacturer',
  'model',
  'ratedPowerKw',
  'lastVerifiedAt',
  'createdAt',
  'updatedAt',
] as const;

export const technicianColumns = [
  'id',
  'fullName',
  'specialization',
  'personnelNumber',
  'createdAt',
  'updatedAt',
] as const;

export const maintenanceRequestColumns = [
  'id',
  'equipmentId',
  'title',
  'description',
  'priority',
  'status',
  'plannedAt',
  'author',
  'closedAt',
  'createdAt',
  'updatedAt',
] as const;

export const requestStatusHistoryColumns = [
  'id',
  'requestId',
  'previousStatus',
  'newStatus',
  'changedBy',
  'comment',
  'changedAt',
] as const;

export const requestAssigneeColumns = [
  'requestId',
  'technicianId',
  'role',
  'plannedHours',
  'assignedAt',
] as const;
