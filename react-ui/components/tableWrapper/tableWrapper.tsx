import React from "react";
import {getAllBrothers} from "../../services/brotherService";

export default function TableWrapperComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isLoaded: false,
            data: null
        };
    }

    componentDidMount() {
        getAllBrothers().then(
            res => this.setState({
                // using spread operator, you will need transform-object-rest-spread from babel or
                // another transpiler to use this
                ...this.state, // spreading in state for future proofing
                isLoaded: true,
                data: res
            })
        );
    }

    render() {
        const { isLoaded, data } = this.state;
        return (
            {
                isLoaded ?
                    <PresentaionComponentThatRequiresAsyncData data={ data } /> :
                    <LoadingSpinner /> // or whatever loading state you want, could be null
            }
        );
    }
}