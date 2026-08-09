export default class BrotherOptionsSchema {

    static offices = [
        "Alpha",
        "Beta",
        "Pi",
        "Sigma",
        "Tau",
        "Iota",
        "Upsilon",
        "Phi",
        "Psi",
        "Chi",
        "Theta",
        "Gamma",
        "Rho",
        "Omega",
        "Omicron"
    ];

    // Boarders are non-member house residents. They carry contact info only —
    // no pledge class, graduation, or office.
    static boarderStatus = "Boarder";

    static statuses = [
        "Active",
        "Pledge",
        "Alumnus",
        "Boarder",
        "Restricted",
        "Suspended",
        "Revoked (Expelled)",
        "Chapter Eternal",
        "Surrendered"
    ]
}