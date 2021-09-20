// tslint:disable:no-empty
import { $enum } from "../../src";
import { expectType, expectError } from "tsd";

type RGB = 1 | 2 | 3;

declare const rgb: RGB | null | undefined;

// Test param types
$enum.visitValue(rgb).with({
    1: (value) => {
        expectType<1>(value);
    },
    2: (value) => {
        expectType<2>(value);
    },
    3: (value) => {
        expectType<3>(value);
    },
    [$enum.handleNull]: (value) => {
        expectType<null>(value);
    },
    [$enum.handleUndefined]: (value) => {
        expectType<undefined>(value);
    },
    [$enum.handleUnexpected]: (value) => {
        expectType<number>(value);
    }
});

// handleUnexpected is optional
$enum.visitValue(rgb).with({
    1: (value) => {},
    2: (value) => {},
    3: (value) => {},
    [$enum.handleNull]: (value) => {},
    [$enum.handleUndefined]: (value) => {}
});

// Return type is inferred
expectType<number>(
    $enum.visitValue(rgb).with({
        1: (value) => 10,
        2: (value) => 20,
        3: (value) => 30,
        [$enum.handleNull]: (value) => -1,
        [$enum.handleUndefined]: (value) => -1
    })
);
expectType<string>(
    $enum.visitValue(rgb).with({
        1: (value) => "10",
        2: (value) => "20",
        3: (value) => "30",
        [$enum.handleNull]: (value) => "-1",
        [$enum.handleUndefined]: (value) => "-1"
    })
);

// Return type is inferred when "unhandled" entries exist
expectType<number>(
    $enum.visitValue(rgb).with({
        1: (value) => 10,
        2: $enum.unhandledEntry,
        3: (value) => 30,
        [$enum.handleNull]: (value) => -1,
        [$enum.handleUndefined]: (value) => -1
    })
);

// special handlers can be unhandled
expectType<number>(
    $enum.visitValue(rgb).with({
        1: (value) => 10,
        2: (value) => 20,
        3: (value) => 30,
        [$enum.handleNull]: $enum.unhandledEntry,
        [$enum.handleUndefined]: $enum.unhandledEntry,
        [$enum.handleUnexpected]: $enum.unhandledEntry
    })
);

// Missing value handler causes error
expectError(
    $enum.visitValue(rgb).with<void>({
        1: (value) => {},
        3: (value) => {},
        [$enum.handleNull]: (value) => {},
        [$enum.handleUndefined]: (value) => {}
    })
);

// Missing null handler causes error
expectError(
    $enum.visitValue(rgb).with<void>({
        1: (value) => {},
        2: (value) => {},
        3: (value) => {},
        [$enum.handleUndefined]: (value) => {}
    })
);

// Missing undefined handler causes error
expectError(
    $enum.visitValue(rgb).with<void>({
        1: (value) => {},
        2: (value) => {},
        3: (value) => {},
        [$enum.handleNull]: (value) => {}
    })
);

// Unexpected value handler causes error
// expectError(
//     $enum.visitValue(rgb).with<void>({
//         1: (value) => {},
//         oops: (value) => {},
//         2: (value) => {},
//         3: (value) => {},
//         [$enum.handleNull]: (value) => {},
//         [$enum.handleUndefined]: (value) => {}
//     })
// );
