import {CircleDollarSign, Radio} from "lucide-react";

export function HeroCoin() {
    return (
        <figure
            className="hero-coin"
            aria-label="A decorative 3D coin representing direct wallet-to-wallet funding"
        >
            <div className="hero-coin__scene" aria-hidden="true">
                <div className="hero-coin__model">
                    <div className="hero-coin__face">
                        <span className="hero-coin__inner-ring">
                            <span className="hero-coin__monogram">
                                <i className="hero-coin__bar hero-coin__bar--left" />
                                <i className="hero-coin__bar hero-coin__bar--slash" />
                                <i className="hero-coin__bar hero-coin__bar--right" />
                            </span>
                        </span>
                    </div>
                </div>
            </div>
            <span className="hero-coin__label hero-coin__label--top">
                <Radio aria-hidden="true" size={12} /> Direct settlement
            </span>
            <span className="hero-coin__label hero-coin__label--bottom">
                <CircleDollarSign aria-hidden="true" size={12} /> No platform cut
            </span>
            <figcaption className="sr-only">
                A decorative coin. Money Nerds donations settle directly between Solana
                wallets.
            </figcaption>
        </figure>
    );
}
