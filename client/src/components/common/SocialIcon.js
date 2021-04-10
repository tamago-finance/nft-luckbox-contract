import styled from "styled-components"
import MediumSVG from "../../assets/img/medium-icon.svg"
import TwitterSVG from "../../assets/img/twitter-icon.svg"
import GithubSVG from "../../assets/img/github-icon.svg"

const Icon = styled.img.attrs(props => ({
    src: props.src
}))`
    height: 24px; 
    filter: invert(0.95); 
`


const SocialIcon = ({ name, url }) => {

    let source

    switch (name) {
        case "medium":
            source = MediumSVG
            break;
        case "twitter":
            source = TwitterSVG
            break;
        case "github":
            source = GithubSVG
            break;
        default:
            break;
    }

    return (
        <a href={url} target="_blank">
            <Icon
                src={source}
            />
        </a>

    )
}

export default SocialIcon