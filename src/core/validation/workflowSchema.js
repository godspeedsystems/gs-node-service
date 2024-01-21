const taskSchema = require("./tasks.schema.json");

module.exports = {
    "$id": "workflow_schema",
    "type": "object",
    "properties": {
        "id": {
            "type": "string"
        },
        "summary": {
            "type": "string"
        },
        "description": {
            "type": "string"
        },
        "tasks": {
            "type": "array",
            "items": [
                {
                    "$ref": "#/definitions/task"
                }
            ]
        }
    },
    "additionalProperties": true,
    "definitions": {
        "task": taskSchema
    }
}