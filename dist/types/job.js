"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobFrequency = exports.JobStatus = void 0;
var JobStatus;
(function (JobStatus) {
    JobStatus["PENDING"] = "PENDING";
    JobStatus["RUNNING"] = "RUNNING";
    JobStatus["COMPLETED"] = "COMPLETED";
    JobStatus["FAILED"] = "FAILED";
    JobStatus["CANCELLED"] = "CANCELLED";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var JobFrequency;
(function (JobFrequency) {
    JobFrequency["ONCE"] = "ONCE";
    JobFrequency["DAILY"] = "DAILY";
    JobFrequency["WEEKLY"] = "WEEKLY";
    JobFrequency["MONTHLY"] = "MONTHLY";
    JobFrequency["CUSTOM"] = "CUSTOM";
})(JobFrequency || (exports.JobFrequency = JobFrequency = {}));
