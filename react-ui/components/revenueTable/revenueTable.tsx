import {IRevenue} from "../../interfaces/api.interface";

interface Props {
    revenueData: Array<IRevenue>
}

export default function RevenueTableComponent(props: Props) {
    return (
        <div>
            {props.revenueData.length === 0 ? (
                <p>No revenue yet.</p>
            ) : (
                <ul>
                    {props.revenueData.map((item) => (
                        <li key={item.id ?? `${item.description}-${String(item.date)}`}>
                            {item.description}: ${item.amount}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}