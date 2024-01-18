const taskSchema = require("./tasks.schema.json");
const fnNameOrTasks = {
    "anyOf": [
        {
            "type": "string"
        },
        {
            "type": "array",
            "items": [
                {
                    "$ref": "#/definitions/task"
                }
            ]
        }
    ]
}
module.exports = {
    "$id": "event_schema",
    "type": "object",
    "properties": {
        "fn": {
            "type": "string"
        },
        "summary": {
            "type": "string"
        },
        "description": {
            "type": "string"
        },
        "body": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "object"
                }
            }
        },
        "params": {
            "type": "array",
            "$ref": "#/definitions/params"
        },
        "parameters": {
            "type": "array",
            "$ref": "#/definitions/params"
        },
        "responses": {
            "type": "object"
        },
        "authn": {
            "type": "boolean"
        },
        "authz": fnNameOrTasks,
        "on_request_validation_error": fnNameOrTasks,
        "on_response_validation_error": fnNameOrTasks
    },
    "additionalProperties": true,
    "definitions": {
        "params": {
            "type": "array",
            "items": [
                {
                    "type": "object",
                    "properties": {
                        "in": {
                            "enum": [
                                "cookie",
                                "path",
                                "query",
                                "header"
                            ]
                        },
                        "name": {
                            "type": "string"
                        },
                        "required": {
                            "type": "boolean"
                        },
                        "schema": {
                            "type": "object"
                        },
                        "description": {
                            "type": "string"
                        },
                        "allow_empty_value": {
                            "type": "boolean"
                        }
                    },
                    "required": [
                        "in",
                        "schema"
                    ]
                }
            ],
            "minItems": 1,
            "maxItems": 10
        },
        "task": taskSchema
    },
    "errorMessage": "It's not a valid event definition. Refer above error for more detail."
}

