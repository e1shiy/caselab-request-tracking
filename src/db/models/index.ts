import type { Sequelize } from 'sequelize';

import { defineEquipmentModel, EquipmentModel } from './equipment.model.js';
import {
  defineEquipmentPassportModel,
  EquipmentPassportModel,
} from './equipment-passport.model.js';
import { defineMaintenanceRequestModel, MaintenanceRequestModel } from './maintenance-request.model.js';
import { defineRequestAssigneeModel, RequestAssigneeModel } from './request-assignee.model.js';
import {
  defineRequestStatusHistoryModel,
  RequestStatusHistoryModel,
} from './request-status-history.model.js';
import { defineSiteModel, SiteModel } from './site.model.js';
import { defineTechnicianModel, TechnicianModel } from './technician.model.js';

export {
  EquipmentModel,
  EquipmentPassportModel,
  MaintenanceRequestModel,
  RequestAssigneeModel,
  RequestStatusHistoryModel,
  SiteModel,
  TechnicianModel,
};

export function initModels(sequelize: Sequelize): void {
  defineSiteModel(sequelize);
  defineEquipmentModel(sequelize);
  defineEquipmentPassportModel(sequelize);
  defineTechnicianModel(sequelize);
  defineMaintenanceRequestModel(sequelize);
  defineRequestStatusHistoryModel(sequelize);
  defineRequestAssigneeModel(sequelize);

  SiteModel.hasMany(EquipmentModel, {
    foreignKey: 'siteId',
    as: 'equipment',
  });
  EquipmentModel.belongsTo(SiteModel, { foreignKey: 'siteId', as: 'site' });

  EquipmentModel.hasOne(EquipmentPassportModel, {
    foreignKey: 'equipmentId',
    as: 'passport',
  });
  EquipmentPassportModel.belongsTo(EquipmentModel, { foreignKey: 'equipmentId', as: 'equipment' });

  EquipmentModel.hasMany(MaintenanceRequestModel, {
    foreignKey: 'equipmentId',
    as: 'requests',
  });
  MaintenanceRequestModel.belongsTo(EquipmentModel, { foreignKey: 'equipmentId', as: 'equipment' });

  MaintenanceRequestModel.hasMany(RequestStatusHistoryModel, {
    foreignKey: 'requestId',
    as: 'history',
  });
  RequestStatusHistoryModel.belongsTo(MaintenanceRequestModel, {
    foreignKey: 'requestId',
    as: 'request',
  });

  MaintenanceRequestModel.belongsToMany(TechnicianModel, {
    through: RequestAssigneeModel,
    foreignKey: 'requestId',
    otherKey: 'technicianId',
    as: 'technicians',
  });
  TechnicianModel.belongsToMany(MaintenanceRequestModel, {
    through: RequestAssigneeModel,
    foreignKey: 'technicianId',
    otherKey: 'requestId',
    as: 'requests',
  });

  MaintenanceRequestModel.hasMany(RequestAssigneeModel, {
    foreignKey: 'requestId',
    as: 'assignees',
  });
  RequestAssigneeModel.belongsTo(MaintenanceRequestModel, {
    foreignKey: 'requestId',
    as: 'request',
  });
  RequestAssigneeModel.belongsTo(TechnicianModel, {
    foreignKey: 'technicianId',
    as: 'technician',
  });
}
